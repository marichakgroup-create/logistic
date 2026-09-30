import {ChevronDown} from 'lucide-react';
import type {ComponentProps} from 'react';

export function Select({className='',children,...props}:ComponentProps<'select'>){
 return <span className="select-wrap"><select className={className} {...props}>{children}</select><ChevronDown size={15} aria-hidden="true"/></span>;
}
