import {describe,expect,it} from 'vitest';
import {apiOrigin} from './api-origin';
describe('local API origin',()=>{
 it('uses the single application listener',()=>{expect(apiOrigin({})).toBe('http://127.0.0.1:3000');expect(apiOrigin({PORT:'8080'})).toBe('http://127.0.0.1:8080');});
 it.each(['0','65536','invalid','3.5'])('rejects invalid ports: %s',PORT=>{expect(()=>apiOrigin({PORT})).toThrow('PORT');});
});
