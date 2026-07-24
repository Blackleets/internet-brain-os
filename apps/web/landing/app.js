// Landing interactions: waitlist form with Formspree + graceful fallback.
(() => {
  const form = document.getElementById('waitlist-form');
  const msg = document.getElementById('waitlist-msg');
  if (!form) return;

  const FORMSPREE_CONFIGURED = !form.action.includes('YOUR_FORM_ID');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      msg.textContent = 'Pon un email válido, porfa.';
      msg.className = 'micro err';
      return;
    }

    // Fallback local: guarda en localStorage aunque Formspree no esté configurado.
    try {
      const list = JSON.parse(localStorage.getItem('efesto_waitlist') || '[]');
      if (!list.includes(email)) list.push(email);
      localStorage.setItem('efesto_waitlist', JSON.stringify(list));
    } catch (_) { /* ignore */ }

    if (!FORMSPREE_CONFIGURED) {
      msg.textContent = '✓ Apuntado (modo demo). Configura Formspree para recibirlo de verdad.';
      msg.className = 'micro ok';
      form.reset();
      return;
    }

    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      if (res.ok) {
        msg.textContent = '✓ Listo. Te avisamos cuando llegue la Web Store.';
        msg.className = 'micro ok';
        form.reset();
      } else {
        throw new Error('bad status');
      }
    } catch (_) {
      msg.textContent = 'Hubo un problema. Inténtalo de nuevo o escríbenos.';
      msg.className = 'micro err';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Avisarme';
    }
  });
})();
