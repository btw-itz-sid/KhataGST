// src/services/emailService.ts
// Email notifications — Nodemailer ke through emails bhejo

import nodemailer from "nodemailer";

// Email transporter setup — Gmail, Outlook, ya custom SMTP use kar sakte ho
let transporter: nodemailer.Transporter;

// Initialize email client
function initializeEmailClient() {
  const emailProvider = process.env.EMAIL_PROVIDER || "development";

  if (emailProvider === "gmail") {
    // Gmail SMTP setup
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password, not regular password
      },
    });
  } else if (emailProvider === "smtp") {
    // Custom SMTP server setup
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development mode — emails print hote hain console mein, file mein nahi likha
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true,
    });
  }
}

// Initialize on module load
initializeEmailClient();

// Email templates  — HTML format mein

function getGSTReturnFiledTemplate(
  businessName: string,
  returnType: string,
  taxPeriod: string,
  arn: string
): string {
  return `
    <html dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
          .content { padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-top: 20px; }
          .footer { color: #999; font-size: 12px; margin-top: 20px; text-align: center; }
          .success { color: #27ae60; font-weight: bold; font-size: 18px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 GST Return Filed Successfully!</h1>
          </div>

          <div class="content">
            <p>Hi <strong>${businessName}</strong>,</p>

            <p>Your GST return has been successfully filed with the GST portal.</p>

            <div style="background: #f0f7ff; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; border-radius: 4px;">
              <p><strong>Return Details:</strong></p>
              <ul style="list-style: none; padding: 0;">
                <li>📋 Return Type: <strong>${returnType}</strong></li>
                <li>📅 Tax Period: <strong>${taxPeriod}</strong></li>
                <li>✅ <span class="success">ARN: ${arn}</span></li>
              </ul>
            </div>

            <p>Please keep this acknowledgment for your records. You can download the complete return summary from your KhataGST dashboard.</p>

            <p style="color: #666; font-size: 14px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
              <strong>Need help?</strong> Contact our support team at support@khatagst.com
            </p>
          </div>

          <div class="footer">
            <p>© 2026 KhataGST. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getReturnDueReminderTemplate(
  businessName: string,
  returnType: string,
  dueDate: string,
  daysLeft: number
): string {
  return `
    <html dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px; }
          .content { padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-top: 20px; }
          .footer { color: #999; font-size: 12px; margin-top: 20px; text-align: center; }
          .warning { color: #e74c3c; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ GST Return Due Reminder</h1>
          </div>

          <div class="content">
            <p>Hi <strong>${businessName}</strong>,</p>

            <p>This is a reminder that your <strong>${returnType}</strong> GST return is due soon.</p>

            <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0; border-radius: 4px;">
              <p><strong>📅 Due Date: ${dueDate}</strong></p>
              <p><span class="warning">⚠️ Days Remaining: ${daysLeft}</span></p>
            </div>

            <p>To avoid penalties, please file your return before the due date. You can file it directly through your KhataGST dashboard.</p>

            <p style="color: #666; font-size: 14px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
              Need assistance? Our team is here to help!
            </p>
          </div>

          <div class="footer">
            <p>© 2026 KhataGST. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getBillScanCompleteTemplate(
  businessName: string,
  scanCount: number,
  successCount: number
): string {
  return `
    <html dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
          .content { padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-top: 20px; }
          .footer { color: #999; font-size: 12px; margin-top: 20px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📸 Bill Scans Processed</h1>
          </div>

          <div class="content">
            <p>Hi <strong>${businessName}</strong>,</p>

            <p>Your AI bill scans have been processed successfully!</p>

            <div style="background: #f0f7ff; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; border-radius: 4px;">
              <p><strong>📊 Summary:</strong></p>
              <ul style="list-style: none; padding: 0;">
                <li>✅ Successfully Scanned: <strong>${successCount}/${scanCount}</strong></li>
                <li>⏳ Processing Time: Just now</li>
              </ul>
            </div>

            <p>Check your dashboard to review the extracted invoice details and make any necessary corrections before filing your GST return.</p>

            <p style="color: #666; font-size: 14px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
              Having issues? Let us know!
            </p>
          </div>

          <div class="footer">
            <p>© 2026 KhataGST. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// Email bhejne ka main function
export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<void> {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || "no-reply@khatagst.com",
      to,
      subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    // Development mode mein email content print karo
    if (process.env.EMAIL_PROVIDER === "development" || !process.env.EMAIL_PROVIDER) {
      console.log("📧 Email (Development Mode):");
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log("HTML Content:", htmlContent.substring(0, 200) + "...");
    } else {
      console.log(`✉️ Email sent successfully to ${to}`, info.messageId);
    }
  } catch (err) {
    console.error("❌ Email send failed:", err);
    // Log but don't throw — email failures shouldn't crash the app
  }
}

// Specific email senders

export async function sendGSTReturnFiledEmail(
  email: string,
  businessName: string,
  returnType: string,
  taxPeriod: string,
  arn: string
): Promise<void> {
  const htmlContent = getGSTReturnFiledTemplate(businessName, returnType, taxPeriod, arn);
  await sendEmail(
    email,
    `GST ${returnType} Return Filed Successfully - ARN: ${arn}`,
    htmlContent
  );
}

export async function sendReturnDueReminderEmail(
  email: string,
  businessName: string,
  returnType: string,
  dueDate: string,
  daysLeft: number
): Promise<void> {
  const htmlContent = getReturnDueReminderTemplate(businessName, returnType, dueDate, daysLeft);
  await sendEmail(
    email,
    `Reminder: ${returnType} GST Return Due on ${dueDate}`,
    htmlContent
  );
}

export async function sendBillScanCompleteEmail(
  email: string,
  businessName: string,
  scanCount: number,
  successCount: number
): Promise<void> {
  const htmlContent = getBillScanCompleteTemplate(businessName, scanCount, successCount);
  await sendEmail(
    email,
    `Your Bill Scans Have Been Processed (${successCount}/${scanCount})`,
    htmlContent
  );
}

export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<void> {
  const htmlContent = `
    <html dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
          .content { padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-top: 20px; }
          .footer { color: #999; font-size: 12px; margin-top: 20px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to KhataGST!</h1>
          </div>

          <div class="content">
            <p>Hi <strong>${name}</strong>,</p>

            <p>Thank you for joining KhataGST! We're excited to help you manage your GST filings efficiently.</p>

            <p>Here's what you can do:</p>
            <ul>
              <li>📱 Scan bills using AI to automatically extract invoice details</li>
              <li>📊 Calculate GST and generate GSTR-1, GSTR-3B returns</li>
              <li>📥 Export your returns in Excel/CSV format</li>
              <li>💼 Manage multiple businesses on your account</li>
            </ul>

            <p>Start by adding your first business in the onboarding process!</p>

            <p style="color: #666; font-size: 14px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
              Questions? Check our help center or contact support@khatagst.com
            </p>
          </div>

          <div class="footer">
            <p>© 2026 KhataGST. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail(email, "Welcome to KhataGST - GST Filing Made Easy", htmlContent);
}
