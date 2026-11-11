// Shared business access checks (owner today; CA links later).

import { query } from "./db.js";

export async function isBusinessOwner(
  businessId: string,
  userId: string
): Promise<boolean> {
  const result = await query(
    "SELECT id FROM businesses WHERE id = $1 AND owner_id = $2",
    [businessId, userId]
  );
  return result.rows.length > 0;
}

/** Owner or linked CA with access to this business. */
export async function canAccessBusiness(
  businessId: string,
  userId: string
): Promise<boolean> {
  const result = await query(
    `SELECT 1
       FROM businesses b
      WHERE b.id = $1
        AND (
          b.owner_id = $2
          OR EXISTS (
            SELECT 1 FROM ca_client_links c
             WHERE c.client_biz_id = b.id AND c.ca_user_id = $2
          )
        )
      LIMIT 1`,
    [businessId, userId]
  );
  return result.rows.length > 0;
}
