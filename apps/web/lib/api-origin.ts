/** Server components call the API in the same process, through its local HTTP listener. */
export function apiOrigin(env:{PORT?:string}={PORT:process.env.PORT}):string {
 const port=Number(env.PORT??3000);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be a valid TCP port');
 return `http://127.0.0.1:${port}`;
}
