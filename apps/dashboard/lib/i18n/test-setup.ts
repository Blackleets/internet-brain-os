// The existing component suites assert the Spanish copy (the es catalog). Pin it for them; the
// i18n suites switch locales explicitly. Real users get browser detection with an English fallback.
import { setLocale } from './index';
setLocale('es', { persist: false });
