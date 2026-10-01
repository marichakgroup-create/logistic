import type {ReactNode} from 'react';

export function Hint({children}:{children:ReactNode}){
 return <details className="inline-hint"><summary aria-label="More information">?</summary><span role="tooltip">{children}</span></details>;
}
