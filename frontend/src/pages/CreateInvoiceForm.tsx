import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch, getApiErrorMessage } from "../lib/api";
import { INDIAN_STATES } from "../lib/indianStates";
import { getBusinessContext } from "../lib/session";

interface LineItem {
  description: string;
  hsn_sac: string;
  quantity: string;
  unit_price: string;
  gst_rate: string;
}

interface PartyOption {
  id: string;
  name: string;
  gstin?: string | null;
  state_code?: string | null;
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function suggestedNumber(): string {
  const stamp = new Date();
  const y = stamp.getFullYear();
  const m = String(stamp.getMonth() + 1).padStart(2, "0");
  const d = String(stamp.getDate()).padStart(2, "0");
  const t = String(stamp.getHours()).padStart(2, "0") + String(stamp.getMinutes()).padStart(2, "0");
  return `INV-${y}${m}${d}-${t}`;
}

const EMPTY_ITEM: LineItem = {
  description: "",
  hsn_sac: "",
  quantity: "1",
  unit_price: "",
  gst_rate: "18",
};

export default function CreateInvoiceForm({ onClose, onCreated }: Props) {
  const [invoiceType, setInvoiceType] = useState<"sale" | "purchase">("sale");
  const [invoiceNumber, setInvoiceNumber] = useState(suggestedNumber);
  const [invoiceDate, setInvoiceDate] = useState(todayIso);
  const [partyId, setPartyId] = useState<string>("");
  const [partyName, setPartyName] = useState("");
  const [partyGstin, setPartyGstin] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [partyQuery, setPartyQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const business = getBusinessContext();
    if (!business?.id) return;
    void apiFetch(`/parties?business_id=${business.id}&type=all`)
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) return;
        const rows = Array.isArray(payload?.parties ?? payload?.data)
          ? payload?.parties ?? payload?.data
          : [];
        setParties(
          rows.map((p: PartyOption) => ({
            id: String(p.id),
            name: String(p.name ?? ""),
            gstin: p.gstin ?? null,
            state_code: p.state_code ?? null,
          }))
        );
      })
      .catch(() => undefined);
  }, []);

  const filteredParties = useMemo(() => {
    const q = partyQuery.trim().toLowerCase();
    if (!q) return parties.slice(0, 8);
    return parties
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.gstin || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [parties, partyQuery]);

  const preview = useMemo(() => {
    let taxable = 0;
    let tax = 0;
    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const price = Math.round((Number(item.unit_price) || 0) * 100);
      const rate = Number(item.gst_rate) || 0;
      const lineTaxable = Math.round(qty * price);
      taxable += lineTaxable;
      tax += Math.round((lineTaxable * rate) / 100);
    }
    return { taxable, tax, total: taxable + tax };
  }, [items]);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function onGstinChange(value: string) {
    const next = value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);
    setPartyGstin(next);
    setPartyId("");
    if (next.length >= 2) setPlaceOfSupply(next.slice(0, 2));
  }

  function pickParty(party: PartyOption) {
    setPartyId(party.id);
    setPartyName(party.name);
    setPartyGstin((party.gstin || "").toUpperCase());
    setPlaceOfSupply(
      party.state_code ||
        (party.gstin && party.gstin.length >= 2 ? party.gstin.slice(0, 2) : "") ||
        ""
    );
    setPartyQuery("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const business = getBusinessContext();
    if (!business?.id) {
      setError("Session expire ho gayi. Dobara sign in karo.");
      return;
    }
    if (!invoiceNumber.trim() || !invoiceDate || !partyName.trim()) {
      setError("Invoice number, date, aur party name zaroori hain.");
      return;
    }

    const payloadItems = items
      .map((item) => ({
        description: item.description.trim() || `${invoiceType === "sale" ? "Sale" : "Purchase"} item`,
        hsn_sac: item.hsn_sac.trim() || undefined,
        quantity: Number(item.quantity) || 1,
        unit_price_paise: Math.round((Number(item.unit_price) || 0) * 100),
        gst_rate: Number(item.gst_rate) || 0,
      }))
      .filter((item) => item.unit_price_paise > 0);

    if (payloadItems.length === 0) {
      setError("Kam se kam ek line with amount add karo.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/invoices", {
        method: "POST",
        body: JSON.stringify({
          business_id: business.id,
          invoice_type: invoiceType,
          invoice_number: invoiceNumber.trim(),
          invoice_date: invoiceDate,
          party_id: partyId || undefined,
          party_name: partyName.trim(),
          party_gstin: partyGstin.trim() || undefined,
          place_of_supply: placeOfSupply || undefined,
          notes: notes.trim() || undefined,
          items: payloadItems,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(getApiErrorMessage(payload, "Invoice save nahi hua."));
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invoice save nahi hua.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="create-overlay" role="dialog" aria-modal="true" aria-labelledby="create-invoice-title">
      <style>{CREATE_STYLES}</style>
      <form className="create-sheet" onSubmit={submit}>
        <div className="create-head">
          <div>
            <div className="create-kicker">Naya invoice</div>
            <h2 id="create-invoice-title">
              {invoiceType === "sale" ? "Sales" : "Purchase"} invoice banao
            </h2>
          </div>
          <button type="button" className="create-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {error && <div className="create-error">{error}</div>}

        <div className="create-tabs">
          <button type="button" className={invoiceType === "sale" ? "on" : ""} onClick={() => setInvoiceType("sale")}>Sale</button>
          <button type="button" className={invoiceType === "purchase" ? "on" : ""} onClick={() => setInvoiceType("purchase")}>Purchase</button>
        </div>

        <div className="create-grid">
          <label>
            <span>Invoice number *</span>
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
          </label>
          <label>
            <span>Date *</span>
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
          </label>
          <label className="full party-field">
            <span>Party search / name *</span>
            <input
              value={partyName}
              onChange={(e) => {
                setPartyName(e.target.value);
                setPartyQuery(e.target.value);
                setPartyId("");
              }}
              placeholder="Customer / vendor naam"
              required
            />
            {partyQuery.trim() && filteredParties.length > 0 && (
              <div className="party-list">
                {filteredParties.map((party) => (
                  <button key={party.id} type="button" className="party-option" onClick={() => pickParty(party)}>
                    <strong>{party.name}</strong>
                    <span>{party.gstin || "No GSTIN"}</span>
                  </button>
                ))}
              </div>
            )}
          </label>
          <label>
            <span>Party GSTIN</span>
            <input value={partyGstin} onChange={(e) => onGstinChange(e.target.value)} placeholder="15-char GSTIN (optional)" maxLength={15} />
          </label>
          <label>
            <span>Place of supply</span>
            <select value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((state) => (
                <option key={state.code} value={state.code}>{state.code} — {state.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="create-lines-label">Line items</div>
        {items.map((item, index) => (
          <div className="create-line" key={index}>
            <input
              placeholder="Description"
              value={item.description}
              onChange={(e) => updateItem(index, { description: e.target.value })}
            />
            <input
              placeholder="HSN"
              value={item.hsn_sac}
              onChange={(e) => updateItem(index, { hsn_sac: e.target.value })}
            />
            <input
              type="number"
              min="0.001"
              step="0.001"
              placeholder="Qty"
              value={item.quantity}
              onChange={(e) => updateItem(index, { quantity: e.target.value })}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Rate ₹"
              value={item.unit_price}
              onChange={(e) => updateItem(index, { unit_price: e.target.value })}
            />
            <select value={item.gst_rate} onChange={(e) => updateItem(index, { gst_rate: e.target.value })}>
              {[0, 5, 12, 18, 28].map((rate) => (
                <option key={rate} value={rate}>{rate}%</option>
              ))}
            </select>
            {items.length > 1 && (
              <button type="button" className="line-remove" onClick={() => setItems(items.filter((_, i) => i !== index))}>Remove</button>
            )}
          </div>
        ))}
        <button type="button" className="add-line" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}>
          + Add line
        </button>

        <label className="full">
          <span>Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </label>

        <div className="create-total">
          <span>Taxable {`₹${(preview.taxable / 100).toFixed(2)}`} · Tax {`₹${(preview.tax / 100).toFixed(2)}`}</span>
          <strong>Total ₹{(preview.total / 100).toFixed(2)}</strong>
        </div>

        <div className="create-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="save" disabled={saving}>
            {saving ? "Saving…" : "Save invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}

const CREATE_STYLES = `
.create-overlay{position:fixed;inset:0;z-index:300;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;padding:12px}
.create-sheet{width:min(720px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:16px 16px 12px 12px;padding:20px;display:flex;flex-direction:column;gap:12px}
.create-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.create-kicker{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af}
.create-head h2{font-size:18px;margin-top:4px}
.create-close{border:none;background:#f3f4f6;border-radius:8px;width:32px;height:32px;cursor:pointer}
.create-error{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:8px;padding:10px 12px;font-size:13px}
.create-tabs{display:flex;gap:8px;background:#f3f4f6;padding:4px;border-radius:9px}
.create-tabs button{flex:1;border:none;background:transparent;padding:8px;border-radius:7px;font-weight:700;cursor:pointer;color:#6b7280}
.create-tabs .on{background:#fff;color:#111827;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.create-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.create-grid label,.create-sheet .full{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:#6b7280}
.create-grid .full{grid-column:1/-1}
.create-sheet input,.create-sheet select{padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;color:#111827;font-weight:500}
.party-field{position:relative}
.party-list{position:absolute;left:0;right:0;top:100%;z-index:5;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.08);max-height:180px;overflow:auto}
.party-option{width:100%;display:flex;justify-content:space-between;gap:8px;padding:10px 12px;border:none;background:#fff;cursor:pointer;text-align:left}
.party-option:hover{background:#fff7ed}
.party-option strong{font-size:13px;color:#111827}
.party-option span{font-size:11px;color:#6b7280;font-family:'JetBrains Mono',monospace}
.create-lines-label{font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em}
.create-line{display:grid;grid-template-columns:2fr .8fr .6fr .8fr .7fr auto;gap:8px}
.add-line,.line-remove,.ghost,.save{border:none;cursor:pointer;font-weight:700}
.add-line{align-self:flex-start;background:#fff7ed;color:#c2410c;padding:8px 12px;border-radius:8px}
.line-remove{background:#fee2e2;color:#991b1b;border-radius:8px;padding:0 10px}
.create-total{display:flex;justify-content:space-between;align-items:center;padding-top:4px;font-size:13px}
.create-total strong{font-family:'JetBrains Mono',monospace;font-size:16px;color:#f97316}
.create-actions{display:flex;justify-content:flex-end;gap:8px}
.ghost{background:#f3f4f6;color:#374151;padding:10px 14px;border-radius:8px}
.save{background:#f97316;color:#fff;padding:10px 16px;border-radius:8px}
.save:disabled{opacity:.6}
@media(max-width:720px){
  .create-grid,.create-line{grid-template-columns:1fr}
  .create-overlay{align-items:stretch}
  .create-sheet{max-height:100vh;border-radius:0}
}
`;
