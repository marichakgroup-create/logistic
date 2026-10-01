import {Check} from 'lucide-react';
import type {ComponentProps} from 'react';

export function Checkbox({className='',...props}:ComponentProps<'input'>){
 return <span className={`check-control ${className}`}><input type="checkbox" {...props}/><span aria-hidden="true"><Check size={14}/></span></span>;
}
