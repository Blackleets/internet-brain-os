import styles from './forge-idle-preview.module.css';

export default function ForgeIdlePreviewPage() {
  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-label="Preview visual de Efesto sin Kernel">
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.brandMark} aria-hidden="true">◇</div>
            <b>EFESTO</b>
          </div>
          <div className={styles.mode} aria-label="Modo de trabajo">
            <span>Chat</span>
            <strong>Goal</strong>
          </div>
          <div className={styles.kernelPill}><i />Kernel sin conexión</div>
        </header>

        <div className={styles.content}>
          <div className={styles.copy}>
            <small>EFESTO · INTELLIGENCE FORGE</small>
            <h1>La forja nunca parece apagada.</h1>
            <p>Sin Kernel, Efesto permanece vivo en reposo. No hay búsquedas, Evidence, SUPPORT ni resultados simulados.</p>
            <div className={styles.truthRow}>
              <span><i className={styles.truthDot} />FORGE EN REPOSO</span>
              <span>0 datos inventados</span>
            </div>
          </div>

          <section className={styles.forgeCard} aria-label="Forja decorativa en reposo">
            <div className={styles.forgeHead}>
              <div>
                <small>FORJA · MODO PRESENCIA</small>
                <h2>Esperando al Kernel</h2>
                <p>La identidad sigue respirando. El motor real continúa bloqueado.</p>
              </div>
              <span className={styles.previewBadge}>PREVIEW · NO LIVE</span>
            </div>

            <div className={styles.stage}>
              <div className={styles.web} aria-hidden="true">
                <span className={styles.ringA} />
                <span className={styles.ringB} />
                <span className={styles.ringC} />
                <span className={styles.lineA} />
                <span className={styles.lineB} />
                <span className={styles.lineC} />
                <span className={styles.node1} /><span className={styles.node2} /><span className={styles.node3} />
                <span className={styles.node4} /><span className={styles.node5} /><span className={styles.node6} />
              </div>

              <div className={styles.ambientLabel}>RED DECORATIVA<br /><span>no son candidatos · no se cuenta</span></div>

              <div className={styles.spider} aria-hidden="true">
                <i className={styles.spiderBody} />
                <i className={styles.leg1} /><i className={styles.leg2} /><i className={styles.leg3} /><i className={styles.leg4} />
                <i className={styles.leg5} /><i className={styles.leg6} /><i className={styles.leg7} /><i className={styles.leg8} />
              </div>

              <div className={styles.anvilWrap} aria-hidden="true">
                <div className={styles.heatHalo} />
                <div className={styles.anvilTop} />
                <div className={styles.anvilStem} />
                <div className={styles.anvilBase} />
                <span className={styles.ember1} /><span className={styles.ember2} /><span className={styles.ember3} />
              </div>

              <div className={styles.statusCard}>
                <span><i />FORGE EN REPOSO</span>
                <b>Conecta el Kernel para investigar de verdad</b>
                <small>Hasta entonces no existen candidatos, Evidence ni Finds.</small>
              </div>
            </div>
          </section>

          <section className={styles.goalBox} aria-label="Entrada de Goal en preview">
            <div>
              <small>¿QUÉ QUIERES FORJAR?</small>
              <p>Escribe un Goal. Prepararlo no ejecuta red ni misiones.</p>
            </div>
            <button type="button" disabled aria-disabled="true">Conectar Kernel</button>
          </section>
        </div>
      </section>
    </main>
  );
}
