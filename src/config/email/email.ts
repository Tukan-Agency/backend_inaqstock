import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  throw new Error("RESEND_API_KEY is not defined in environment variables.");
}

const resend = new Resend(apiKey);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  html: string;
}

const sendEmail = async ({ to, from, subject, html }: EmailParams): Promise<void> => {
  try {
    await resend.emails.send({
      to,
      from,
      subject,
      html,
    });
    console.log("Email sent successfully.");
  } catch (e: any) {
    console.error("Error occurred while sending email:", e.message);
  }
};

export default sendEmail;
