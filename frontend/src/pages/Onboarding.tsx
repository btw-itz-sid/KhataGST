import { useState } from 'react'

interface Props {
  token: string
  onComplete: () => void
}

const STATES = [
  'Andhra Pradesh', 'Delhi', 'Gujarat', 'Karnataka',
  'Maharashtra', 'Rajasthan', 'Tamil Nadu', 'Uttar Pradesh',
  'West Bengal', 'Telangana', 'Madhya Pradesh', 'Punjab'
]

export default function Onboarding({ token, onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [gstType, setGstType] = useState('')
  const [state, setState] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          legal_name: businessName,
          owner_name: ownerName,
          gst_type: gstType,
          state_name: state,
          gstin: null
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Business save nahi hua')
      setStep(3)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-green-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Step 1 — Business Info */}
        {step === 1 && (
          <>
            <h2 className="text-xl font-bold mb-1">Apna business batao 🏪</h2>
            <p className="text-gray-500 text-sm mb-6">Basic details fill karo — 1 minute lagega</p>

            {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</div>}

            <label className="text-sm font-medium text-gray-700">Business ka naam</label>
            <input
              className="w-full mt-1 mb-4 px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Jaise: Ramesh General Store"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
            />

            <label className="text-sm font-medium text-gray-700">Owner ka naam</label>
            <input
              className="w-full mt-1 mb-6 px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Jaise: Ramesh Kumar"
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
            />

            <button
              onClick={() => setStep(2)}
              disabled={!businessName || !ownerName}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-40"
            >
              Aage Badhein →
            </button>
          </>
        )}

        {/* Step 2 — GST Type + State */}
        {step === 2 && (
          <>
            <h2 className="text-xl font-bold mb-1">GST details 📋</h2>
            <p className="text-gray-500 text-sm mb-6">Yeh GST calculation ke liye zaroori hai</p>

            <label className="text-sm font-medium text-gray-700">GST Type</label>
            <div className="grid grid-cols-3 gap-2 mt-1 mb-4">
              {['Regular', 'Composition', 'Unregistered'].map(type => (
                <button
                  key={type}
                  onClick={() => setGstType(type)}
                  className={`py-2.5 text-sm rounded-lg border font-medium transition ${gstType === type ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-700 hover:border-green-400'}`}
                >
                  {type}
                </button>
              ))}
            </div>

            <label className="text-sm font-medium text-gray-700">State</label>
            <select
              className="w-full mt-1 mb-6 px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              value={state}
              onChange={e => setState(e.target.value)}
            >
              <option value="">State chuniye</option>
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>

            <button
              onClick={handleSubmit}
              disabled={!gstType || !state || loading}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-40"
            >
              {loading ? 'Save ho raha hai...' : 'Complete Karo ✓'}
            </button>

            <button onClick={() => setStep(1)} className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700">
              ← Wapas jaao
            </button>
          </>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold mb-2">Setup complete!</h2>
            <p className="text-gray-500 text-sm mb-8">
              <span className="font-semibold text-gray-800">{businessName}</span> ready hai GST filing ke liye
            </p>
            <button
              onClick={onComplete}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              Dashboard pe Jaao →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}