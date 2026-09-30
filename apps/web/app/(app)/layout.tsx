import { WorkspaceShell } from '../../components/workspace-shell';
import { serverApi } from '../../lib/server-api';
export default async function AppLayout({children}:{children:React.ReactNode}) {
  const {user}=await serverApi<{user:{email:string}}>('/auth/me');
  return <WorkspaceShell email={user.email}>{children}</WorkspaceShell>;
}
