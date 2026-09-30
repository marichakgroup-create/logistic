import { Brand } from '../../components/brand';
import { Navigation } from '../../components/navigation';
import { serverApi } from '../../lib/server-api';
export default async function AppLayout({children}:{children:React.ReactNode}) {
  await serverApi('/auth/me');
  return <div className="app-frame"><header className="app-header"><Brand/><Navigation/></header><main className="app-main">{children}</main><div className="mobile-nav"><Navigation/></div></div>;
}
