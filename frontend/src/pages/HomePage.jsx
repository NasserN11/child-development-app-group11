import { Navigate } from "react-router-dom";
import { getUser } from "../auth";

export default function HomePage() {
    const user = getUser();
    if (user?.role === 'child') return <Navigate to="/tasks" replace />;
    return <h1>Welcome, {user?.name}</h1>
}