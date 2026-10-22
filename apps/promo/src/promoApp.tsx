import { useEffect } from 'react';

import { EditorShowcase } from './components/icon-core/EditorShowcase';
import { Footer } from './components/icon-core/Footer';
import { Header } from './components/icon-core/Header';
import { Hero } from './components/icon-core/Hero';
import { Platforms } from './components/icon-core/Platforms';
import { StudioProvider } from './components/icon-core/studio-context';
import { siteConfig } from './lib/site-config';

/*
 * These three labels are the promo site's own wording. Only "Create in Edit Space" is also a
 * heading in the app's welcome modal; the other two are written there as "Upload → Export" and
 * "Upload → Edit → Export". README.pt-BR lists all three exactly as below (the English README
 * uses different section headings), so the titles stay as they are.
 */
const workflows = [
  {
    title: 'Create in Edit Space',
    text: 'Comece com a tela em branco, monte camadas, ajuste variantes e mantenha o projeto editável.',
    meta: 'Edição em camadas'
  },
  {
    title: 'Upload to Export Utilities',
    text: 'Solte um logo que já existe e gere na hora os assets para web, PWA, desktop e divulgação.',
    meta: 'Exportação rápida'
  },
  {
    title: 'Upload, Adjust, Export',
    text: 'Importe o arquivo no Edit Space, ajuste posição e variantes e envie para o Export Utilities.',
    meta: 'Fluxo único'
  }
];

const faqs = [
  {
    q: 'O Icon Core é grátis?',
    a: 'É. O Icon Core é open source, gratuito e feito para rodar localmente, para designers e desenvolvedores.'
  },
  {
    q: 'Preciso subir arquivos para um servidor?',
    a: 'Não. O fluxo no navegador processa os arquivos localmente, e o app desktop mantém o mesmo modelo local-first.'
  },
  {
    q: 'Posso contribuir?',
    a: 'Pode. O projeto é público no GitHub, e issues, ideias e pull requests são bem-vindos.'
  }
];

const WorkflowMini = ({ index }: { index: number }) => {
  if (index === 0) {
    return (
      <div className="workflow-mini">
        <div className="mini-canvas"><span /></div>
        <div className="mini-handles"><b /><b /><b /></div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="workflow-mini mini-export">
        <span />
        <span />
        <span />
        <strong />
      </div>
    );
  }

  return (
    <div className="workflow-mini mini-flow">
      <span>importar</span>
      <i />
      <span>ajustar</span>
      <i />
      <span>exportar</span>
    </div>
  );
};

export const PromoApp = () => {
  useEffect(() => {
    /*
     * A fragment in the URL is resolved before React mounts, so the browser finds no
     * target and gives up. Retrying once after mount is what makes `/#baixar` (and the
     * legacy `/#desktop`) land where it says; `scroll-margin-top` still clears the
     * fixed header.
     */
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <StudioProvider>
      <div className="promo-root">
        <Header />

        <main>
          <Hero />
          <Platforms />
          <EditorShowcase />

          {/*
            Pre-P6 sections, now in pt-BR. They keep their original anchors (#workflows,
            #edit-space, #export-utilities, #community) so links already in the wild keep
            resolving. `#baixar` and its `#desktop` alias live in the showcase's GetItStrip,
            next to the editor they download.
          */}
          <div className="promo-legacy">
            <section id="workflows" className="section-block scroll-mt-24">
              <div className="section-heading">
                <h2>Escolha o workspace que combina com o seu fluxo de ícones.</h2>
                <p>Todo caminho continua gratuito e local-first. Comece do zero, exporte direto ou ajuste antes de empacotar.</p>
              </div>
              <div className="workflow-grid">
                {workflows.map((item, index) => (
                  <article key={item.title} className={index === 2 ? 'workflow-card is-featured' : 'workflow-card'}>
                    <WorkflowMini index={index} />
                    <span>{item.meta}</span>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section id="edit-space" className="split-section scroll-mt-24">
              <div>
                <h2>O Edit Space é para ajuste preciso do ícone.</h2>
                <p>
                  Organize camadas, ajuste posição e escala, mantenha os ajustes por variante e confira as propriedades
                  da camada selecionada antes de exportar.
                </p>
              </div>
              <div className="feature-panel">
                <span>Camadas arrastáveis</span>
                <span>Propriedades no botão direito</span>
                <span>Abas de variante</span>
                <span>Forma, texto, imagem, SVG</span>
              </div>
            </section>

            <section id="export-utilities" className="split-section split-section-alt scroll-mt-24">
              <div className="feature-panel export-panel">
                <span>favicon</span>
                <span>manifesto PWA</span>
                <span>Tauri</span>
                <span>Electron</span>
                <span>imagens de divulgação</span>
              </div>
              <div>
                <h2>O Export Utilities empacota os assets sem esconder os detalhes.</h2>
                <p>
                  Escolha os targets e as variantes de que você precisa, revise a estrutura gerada e baixe um ZIP pronto
                  para apps open source e documentação.
                </p>
              </div>
            </section>

            <section id="community" className="community-section scroll-mt-24">
              <div>
                <h2>Feito em aberto.</h2>
                <p>
                  O Icon Core existe como uma ferramenta aberta à comunidade. Use, inspecione, abra issues, sugira fluxos
                  ou ajude a melhorar o editor e os exportadores.
                </p>
              </div>
              <div className="community-actions">
                <a className="button button-primary" href={siteConfig.repoUrl} target="_blank" rel="noreferrer">Entrar no GitHub</a>
                <a className="button" href={`${siteConfig.repoUrl}/issues`} target="_blank" rel="noreferrer">Abrir issues</a>
              </div>
            </section>

            <section className="faq-section">
              {faqs.map((item) => (
                <article key={item.q}>
                  <h3>{item.q}</h3>
                  <p>{item.a}</p>
                </article>
              ))}
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </StudioProvider>
  );
};
