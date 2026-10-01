import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { ServiceError } from './errors';
import type {LostOrderEmail,OrderNotificationSender} from './notifications';

export interface EmailSender { sendMagicLink(email: string, url: string): Promise<void> }

export class LocalEmailSender implements EmailSender,OrderNotificationSender {
  constructor(private directory: string) {
    if (process.env.NODE_ENV === 'production') throw new Error('Local email is development-only');
  }
  async sendMagicLink(email: string, url: string) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await writeFile(resolve(this.directory, `${Date.now()}-${randomUUID()}.json`),
      JSON.stringify({ to: email, subject: 'Your LoadLink sign-in link', url }, null, 2), { mode: 0o600 });
  }
  async sendOrderLost(email:string,data:LostOrderEmail){await this.write(email,'A load in your trip is no longer available',{trip:data.tripUrl,route:`${data.pickupAddress} → ${data.deliveryAddress}`});}
  private async write(email:string,subject:string,data:Record<string,string>){await mkdir(this.directory,{recursive:true,mode:0o700});await writeFile(resolve(this.directory,`${Date.now()}-${randomUUID()}.json`),JSON.stringify({to:email,subject,...data},null,2),{mode:0o600});}
}

export class ResendEmailSender implements EmailSender,OrderNotificationSender {
  constructor(private apiKey: string, private from: string) {}
  async sendMagicLink(email: string, url: string) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [email], subject: 'Your LoadLink sign-in link',
        text: `Sign in to LoadLink: ${url}\n\nThis link expires in 15 minutes and works once. If you did not request it, ignore this email.` }),
    });
    if (!response.ok) throw new ServiceError('EMAIL_UNAVAILABLE', 'Email delivery is unavailable. Please retry.', 503);
  }
  async sendOrderLost(email:string,data:LostOrderEmail){await this.send(email,'A load in your trip is no longer available',`The load ${data.pickupAddress} → ${data.deliveryAddress} is no longer available. Review your trip: ${data.tripUrl}`);}
  private async send(email:string,subject:string,text:string){const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:this.from,to:[email],subject,text})});if(!response.ok)throw new ServiceError('EMAIL_UNAVAILABLE','Email delivery is unavailable. Please retry.',503);}
}
