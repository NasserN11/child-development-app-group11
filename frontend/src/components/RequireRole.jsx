import { Navigate, Outlet } from 'react-router-dom';
import { getUser } from '../auth';

export default function RequireRole({ allow }) {
    const user = getUser();
    if (!user || !allow.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}