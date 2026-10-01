import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {ServiceError} from '@loadlink/services';

export class GoogleAuth {
 private client:OAuth2Client;
 private callback:string;
 constructor(private clientId:string,clientSecret:string,appUrl:string,private secret:string){
  this.callback=appUrl+'/v1/auth/google/callback';
  this.client=new OAuth2Client(clientId,clientSecret,this.callback);
 }
 start(){
  const state=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('hex');
  const payload=Buffer.from(JSON.stringify({state,verifier,nonce,expires:Date.now()+600000})).toString('base64url');
  const cookie=payload+'.'+this.sign(payload);
  const url=this.client.generateAuthUrl({scope:['openid','email'],state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256' as import('google-auth-library').CodeChallengeMethod,prompt:'select_account'});
  return{cookie,url};
 }
 async finish(code:string,state:string,cookie:string|undefined){
  if(!cookie||!code||code.length>4096)throw this.invalid();
  const [payload,signature]=cookie.split('.');const expected=this.sign(payload??'');
  if(!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw this.invalid();
  const data=JSON.parse(Buffer.from(payload,'base64url').toString()) as {state:string;verifier:string;nonce:string;expires:number};
  if(data.state!==state||data.expires<Date.now())throw this.invalid();
  const {tokens}=await this.client.getToken({code,codeVerifier:data.verifier,redirect_uri:this.callback});
  if(!tokens.id_token)throw this.invalid();
  const ticket=await this.client.verifyIdToken({idToken:tokens.id_token,audience:this.clientId});
  const profile=ticket.getPayload();
  if(!profile||!profile.email||!profile.email_verified||!profile.sub||(profile as unknown as {nonce?:string}).nonce!==data.nonce)throw this.invalid();
  // Google must remain authoritative for the email used to link an existing email account.
  return{email:profile.email,subject:profile.sub,authoritative:profile.email.toLowerCase().endsWith('@gmail.com')||Boolean(profile.hd)};
 }
 private sign(value:string){return createHmac('sha256',this.secret).update(value).digest('hex');}
 private invalid(){return new ServiceError('GOOGLE_AUTH_FAILED','Google sign-in failed. Please try again.',401);}
}
