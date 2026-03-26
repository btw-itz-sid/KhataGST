import * as fs from "fs";
import * as path from "path";

const DEV_OTP_LOG_PATH = path.resolve(
    process.cwd(),
    process.env.DEV_OTP_LOG_PATH || "dev-otp.log"
);

function logDevOtp(phone: string, otp: string): void {
    const line = `[${new Date().toISOString()}] OTP for ${phone}: ${otp}\n`;
    console.log(line.trim());
    fs.appendFileSync(DEV_OTP_LOG_PATH, line, "utf8");
}

/**
 * Sends OTP via Fast2SMS in production.
 * In development, skips the API call and logs OTP to dev-otp.log instead.
 */
export async function sendOTP(phone: string, otp: string): Promise<void> {
    // Development mode — skip real SMS, just log
    if (process.env.NODE_ENV !== "production") {
        logDevOtp(phone, otp);
        return;
    }

    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
        throw new Error("FAST2SMS_API_KEY not set in environment");
    }

    const message = `${otp} is your KhataGST login OTP. Valid for 10 minutes. Do not share with anyone.`;

    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
            authorization: apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            route: "otp",           // Fast2SMS OTP route (cheapest)
            variables_values: otp,  // The 6-digit OTP
            numbers: phone,         // 10-digit Indian mobile number
            flash: 0,
        }),
    });

    const data = (await response.json()) as {
        return: boolean;
        status_code: number;
        message: string[];
        request_id?: string;
    };

    if (!response.ok || !data.return) {
        // Log the failure details for debugging
        console.error("Fast2SMS error:", data);
        throw new Error(
            `Fast2SMS OTP send failed: ${data.message?.join(", ") ?? "Unknown error"}`
        );
    }

    console.log(`OTP sent to ${phone} via Fast2SMS — request_id: ${data.request_id}`);
}