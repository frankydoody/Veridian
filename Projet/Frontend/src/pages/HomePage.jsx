import { useAuth } from '../context/AuthContext.jsx';

function HomePage() {
  const { user, logout } = useAuth();

  return (
    <>
      <h1>Bonjour {user.name}</h1>
      <button onClick={logout}>Se déconnecter</button>
    </>
  );
}

export default HomePage;
