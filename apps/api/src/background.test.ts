import {afterEach,describe,expect,it,vi} from 'vitest';
import {startBackground} from './background';
afterEach(()=>vi.useRealTimers());
describe('background imports',()=>{
 it('never overlaps, schedules after completion and stops cleanly',async()=>{
  vi.useFakeTimers();let finish!:()=>void;
  const task=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
  const stop=startBackground(task,1000);
  await vi.advanceTimersByTimeAsync(5000);expect(task).toHaveBeenCalledTimes(1);
  finish();await vi.advanceTimersByTimeAsync(1000);expect(task).toHaveBeenCalledTimes(2);
  const stopped=stop();finish();await stopped;
  await vi.advanceTimersByTimeAsync(5000);expect(task).toHaveBeenCalledTimes(2);
 });
 it('retries a failed import on the next interval',async()=>{
  vi.useFakeTimers();const log=vi.spyOn(process.stderr,'write').mockReturnValue(true);
  const task=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const stop=startBackground(task,1000);await vi.advanceTimersByTimeAsync(1000);
  expect(task).toHaveBeenCalledTimes(2);await stop();log.mockRestore();
 });
});
