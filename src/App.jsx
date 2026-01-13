import { useState, useEffect } from 'react';
import SpecRefiner from './SpecRefiner';
import AdminPage from './components/AdminPage';

function App() {
    const [path, setPath] = useState(window.location.pathname);

    useEffect(() => {
        const onPopState = () => setPath(window.location.pathname);
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    if (path === '/adminFurdAc') {
        return <AdminPage />;
    }

    return <SpecRefiner />;
}

export default App;
