FLOW — Sistema Financeiro (PWA) — FULL
Passos:
1) Firebase: ative Authentication (Email/Password + Anonymous) e Firestore.
2) Copie as chaves Web e cole em firebase-config.js.
3) Publique a pasta em GitHub Pages / Netlify / Vercel.
4) No iPhone (Safari) → Compartilhar → Adicionar à Tela de Início.
Coleções por usuário:
- transactions: {type:'income'|'expense', amount, category, date:'YYYY-MM-DD', desc, createdAt}
- budgets: {category, limit}
- instalments: {desc, total, qty, valuePer, first, paid:[bool], card}
- goals: {title, target, deadline, image, saved}
- cards: {bank, limit, due, brand}
