import dotenv from "dotenv";

dotenv.config();

export function getAuthHeader(): { Authorization: string } {
  const token = process.env.BEARER_TOKEN;
  if (!token) {
    throw new Error("BEARER_TOKEN not set in environment");
  }
  return { Authorization: `Bearer ${token}` };
}
