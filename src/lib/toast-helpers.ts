import { toast } from "sonner";
import { getApiError } from "@/lib/validation";

/**
 * Show an error toast from a failed API response.
 * Tries to extract an error message from the response body,
 * falls back to the provided string.
 */
export async function toastApiError(
  res: Response,
  fallback: string,
): Promise<void> {
  const message = await getApiError(res, fallback);
  toast.error(message);
}
