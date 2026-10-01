/** Run immediately, then delay after completion; never overlap within this process. */
export function startBackground(task:()=>Promise<void>,intervalMs=60000){
 let stopped=false;
 let timer:ReturnType<typeof setTimeout>|undefined;
 let running:Promise<void>;
 const run=()=>{
  running=task().catch(error=>{process.stderr.write(JSON.stringify({event:'sync_failed',message:error instanceof Error?error.message:'Unknown error'})+'\n');}).finally(()=>{
   if(!stopped){timer=setTimeout(run,intervalMs);timer.unref();}
  });
 };
 run();
 return async()=>{stopped=true;if(timer)clearTimeout(timer);await running;};
}
