import { DeployConsole } from "./_components/DeployConsole";

export default function DeployPage() {
  return (
    <section className="ot-deploy-page" aria-labelledby="ot-deploy-title">
      <header className="ot-deploy-page__head">
        <h1 id="ot-deploy-title">Launch your agent</h1>
        <p>Three short steps. Then it's yours.</p>
      </header>
      <DeployConsole />
    </section>
  );
}
