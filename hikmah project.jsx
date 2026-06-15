import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// MOCK BACKEND / DATABASE ENGINE (localStorage-based)
// Mirrors a real Node.js + Express + MongoDB architecture
// ============================================================
const DB = {
  // --- Users Collection ---
  getUsers: () => JSON.parse(localStorage.getItem("hikmah_users") || "[]"),
  saveUsers: (u) => localStorage.setItem("hikmah_users", JSON.stringify(u)),

  // --- Branches Collection ---
  getBranches: () => JSON.parse(localStorage.getItem("hikmah_branches") || "[]"),
  saveBranches: (b) => localStorage.setItem("hikmah_branches", JSON.stringify(b)),

  // --- Staff Collection ---
  getStaff: () => JSON.parse(localStorage.getItem("hikmah_staff") || "[]"),
  saveStaff: (s) => localStorage.setItem("hikmah_staff", JSON.stringify(s)),

  // --- Session ---
  getSession: () => JSON.parse(localStorage.getItem("hikmah_session") || "null"),
  setSession: (s) => localStorage.setItem("hikmah_session", JSON.stringify(s)),
  clearSession: () => localStorage.removeItem("hikmah_session"),
};

// Crypto helpers (mirrors bcryptjs + JWT pattern)
const hashPassword = (pw) => btoa(pw + "_hikmah_salt_v1");
const verifyPassword = (pw, hash) => hashPassword(pw) === hash;
const generateId = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const generateToken = (userId) => btoa(JSON.stringify({ userId, exp: Date.now() + 86400000 }));
const verifyToken = (token) => {
  try {
    const payload = JSON.parse(atob(token));
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
};

// ============================================================
// API LAYER — mirrors Express route handlers
// ============================================================
const API = {
  register: ({ name, email, password }) => {
    const users = DB.getUsers();
    if (users.find((u) => u.email === email)) return { error: "Email already registered." };
    const isFirstUser = users.length === 0;
    const newUser = {
      _id: generateId(), name, email,
      passwordHash: hashPassword(password),
      role: isFirstUser ? "admin" : "pending",
      onboardingComplete: false,
      createdAt: new Date().toISOString(),
    };
    DB.saveUsers([...users, newUser]);
    const token = generateToken(newUser._id);
    DB.setSession({ token, userId: newUser._id });
    return { user: { ...newUser, passwordHash: undefined }, token };
  },

  login: ({ email, password }) => {
    const users = DB.getUsers();
    const user = users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) return { error: "Invalid email or password." };
    const token = generateToken(user._id);
    DB.setSession({ token, userId: user._id });
    return { user: { ...user, passwordHash: undefined }, token };
  },

  logout: () => { DB.clearSession(); return { ok: true }; },

  getCurrentUser: () => {
    const session = DB.getSession();
    if (!session) return null;
    const payload = verifyToken(session.token);
    if (!payload) { DB.clearSession(); return null; }
    const users = DB.getUsers();
    const user = users.find((u) => u._id === payload.userId);
    return user ? { ...user, passwordHash: undefined } : null;
  },

  addBranch: ({ name, address, contactNumber }) => {
    const branch = { _id: generateId(), name, address, contactNumber, createdAt: new Date().toISOString() };
    DB.saveBranches([...DB.getBranches(), branch]);
    return branch;
  },

  addStaff: ({ fullName, phone, emergencyContact, profilePicture, branchId }) => {
    const member = { _id: generateId(), fullName, phone, emergencyContact, profilePicture, branchId, createdAt: new Date().toISOString() };
    DB.saveStaff([...DB.getStaff(), member]);
    return member;
  },

  completeOnboarding: () => {
    const users = DB.getUsers();
    const session = DB.getSession();
    if (!session) return;
    const updated = users.map((u) => u._id === session.userId ? { ...u, onboardingComplete: true } : u);
    DB.saveUsers(updated);
  },

  getBranches: () => DB.getBranches(),
  getStaff: () => DB.getStaff(),
  getAllUsers: () => DB.getUsers().map((u) => ({ ...u, passwordHash: undefined })),
};

// ============================================================
// DESIGN SYSTEM TOKENS
// Deep Emerald (#065F46) primary, Warm Gold (#D97706) CTA,
// Slate whites for backgrounds, Crimson for danger states
// ============================================================
const ds = {
  emerald: { 50: "#ECFDF5", 100: "#D1FAE5", 500: "#10B981", 600: "#059669", 700: "#047857", 800: "#065F46", 900: "#064E3B" },
  gold: { 400: "#FBBF24", 500: "#F59E0B", 600: "#D97706", 700: "#B45309" },
  slate: { 50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0", 300: "#CBD5E1", 400: "#94A3B8", 500: "#64748B", 700: "#334155", 800: "#1E293B", 900: "#0F172A" },
  red: { 100: "#FEE2E2", 600: "#DC2626" },
};

// ============================================================
// COMPONENT LIBRARY
// ============================================================

const Logo = ({ size = "md" }) => {
  const sz = size === "lg" ? { icon: 48, text: "text-3xl", sub: "text-sm" } : { icon: 36, text: "text-xl", sub: "text-xs" };
  return (
    <div className="flex items-center gap-3">
      <div style={{ width: sz.icon, height: sz.icon, background: `linear-gradient(135deg, ${ds.emerald[700]}, ${ds.emerald[500]})`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 14px ${ds.emerald[800]}40` }}>
        <svg width={sz.icon * 0.55} height={sz.icon * 0.55} viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <div className={`font-bold tracking-tight ${sz.text}`} style={{ color: ds.emerald[800], fontFamily: "Georgia, serif", letterSpacing: "-0.02em" }}>Hikmah</div>
        <div className={sz.sub} style={{ color: ds.slate[400], letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 10 }}>Business Platform</div>
      </div>
    </div>
  );
};

const Input = ({ label, type = "text", value, onChange, placeholder, required, error, hint, icon, accept }) => (
  <div style={{ marginBottom: 20 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: ds.slate[700], marginBottom: 6, letterSpacing: "0.01em" }}>{label}{required && <span style={{ color: ds.gold[600], marginLeft: 3 }}>*</span>}</label>}
    <div style={{ position: "relative" }}>
      {icon && <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: ds.slate[400] }}>{icon}</span>}
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder} accept={accept}
        style={{
          width: "100%", padding: icon ? "11px 14px 11px 40px" : "11px 14px",
          border: `1.5px solid ${error ? ds.red[600] : ds.slate[200]}`,
          borderRadius: 10, fontSize: 14, color: ds.slate[800], background: "white",
          outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
        onFocus={(e) => { e.target.style.borderColor = ds.emerald[500]; e.target.style.boxShadow = `0 0 0 3px ${ds.emerald[50]}`; }}
        onBlur={(e) => { e.target.style.borderColor = error ? ds.red[600] : ds.slate[200]; e.target.style.boxShadow = "none"; }}
      />
    </div>
    {error && <p style={{ fontSize: 12, color: ds.red[600], marginTop: 4 }}>{error}</p>}
    {hint && !error && <p style={{ fontSize: 12, color: ds.slate[400], marginTop: 4 }}>{hint}</p>}
  </div>
);

const Btn = ({ children, onClick, variant = "primary", type = "button", disabled, fullWidth, size = "md", loading }) => {
  const base = { border: "none", cursor: disabled ? "not-allowed" : "pointer", borderRadius: 10, fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.6 : 1 };
  const sizes = { sm: { padding: "8px 16px", fontSize: 13 }, md: { padding: "12px 24px", fontSize: 14 }, lg: { padding: "14px 32px", fontSize: 15 } };
  const variants = {
    primary: { background: `linear-gradient(135deg, ${ds.emerald[700]}, ${ds.emerald[600]})`, color: "white", boxShadow: `0 4px 12px ${ds.emerald[800]}30` },
    gold: { background: `linear-gradient(135deg, ${ds.gold[600]}, ${ds.gold[500]})`, color: "white", boxShadow: `0 4px 12px ${ds.gold[700]}30` },
    outline: { background: "white", color: ds.emerald[700], border: `1.5px solid ${ds.emerald[500]}` },
    ghost: { background: "transparent", color: ds.slate[500] },
    danger: { background: ds.red[100], color: ds.red[600] },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      style={{ ...base, ...sizes[size], ...variants[variant], width: fullWidth ? "100%" : "auto" }}
      onMouseEnter={(e) => { if (!disabled) e.target.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; }}
    >
      {loading && <Spinner size={16} color="white" />}
      {children}
    </button>
  );
};

const Spinner = ({ size = 20, color = ds.emerald[600] }) => (
  <div style={{ width: size, height: size, border: `2px solid transparent`, borderTopColor: color, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: "white", borderRadius: 16, border: `1px solid ${ds.slate[100]}`, boxShadow: "0 4px 24px rgba(0,0,0,0.06)", ...style }}>
    {children}
  </div>
);

const Alert = ({ type = "error", children }) => {
  const styles = {
    error: { bg: ds.red[100], color: ds.red[600], icon: "⚠️" },
    success: { bg: ds.emerald[50], color: ds.emerald[700], icon: "✓" },
    info: { bg: "#EFF6FF", color: "#1D4ED8", icon: "ℹ" },
  };
  const s = styles[type];
  return (
    <div style={{ background: s.bg, color: s.color, padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <span>{s.icon}</span>{children}
    </div>
  );
};

const Badge = ({ children, variant = "default" }) => {
  const variants = {
    admin: { bg: ds.emerald[100], color: ds.emerald[800] },
    pending: { bg: "#FEF3C7", color: "#92400E" },
    default: { bg: ds.slate[100], color: ds.slate[600] },
  };
  const v = variants[variant] || variants.default;
  return <span style={{ ...v, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{children}</span>;
};

const ProgressStepper = ({ steps, current }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
    {steps.map((step, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, transition: "all 0.3s",
              background: done ? ds.emerald[600] : active ? ds.gold[600] : ds.slate[100],
              color: done || active ? "white" : ds.slate[400],
              boxShadow: active ? `0 0 0 4px ${ds.gold[500]}30` : "none",
            }}>{done ? "✓" : i + 1}</div>
            <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? ds.emerald[700] : done ? ds.slate[500] : ds.slate[300], whiteSpace: "nowrap" }}>{step}</span>
          </div>
          {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: done ? ds.emerald[400] : ds.slate[100], margin: "0 4px", marginBottom: 20, transition: "background 0.3s" }} />}
        </div>
      );
    })}
  </div>
);

// ============================================================
// PAGE COMPONENTS
// ============================================================

// --- AUTH PAGE ---
const AuthPage = ({ onAuth }) => {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const usersExist = DB.getUsers().length > 0;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (mode === "register") {
      if (!form.name.trim()) e.name = "Full name is required";
      if (form.password.length < 8) e.password = "Password must be at least 8 characters";
      if (form.password !== form.confirm) e.confirm = "Passwords do not match";
    }
    if (!form.email.includes("@")) e.email = "Enter a valid email address";
    if (!form.password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    setApiError("");
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      const res = mode === "register" ? API.register(form) : API.login(form);
      setLoading(false);
      if (res.error) { setApiError(res.error); return; }
      onAuth(res.user);
    }, 600);
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${ds.emerald[900]} 0%, ${ds.emerald[700]} 60%, ${ds.slate[800]} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity:0; transform:translateY(16px);} to {opacity:1;transform:translateY(0);}}`}</style>

      {/* Decorative background blobs */}
      <div style={{ position: "fixed", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: `${ds.gold[500]}15`, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: `${ds.emerald[500]}20`, pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 440, animation: "fadeUp 0.4s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Logo size="lg" />
          <p style={{ color: `${ds.emerald[100]}90`, fontSize: 14, marginTop: 8 }}>Empowering your business, one branch at a time.</p>
        </div>

        <Card style={{ padding: "36px 40px" }}>
          {/* Tab switcher */}
          <div style={{ display: "flex", background: ds.slate[50], borderRadius: 10, padding: 4, marginBottom: 28, gap: 4 }}>
            {["login", "register"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setErrors({}); setApiError(""); }}
                style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "all 0.2s", fontFamily: "inherit",
                  background: mode === m ? "white" : "transparent",
                  color: mode === m ? ds.emerald[700] : ds.slate[400],
                  boxShadow: mode === m ? "0 1px 6px rgba(0,0,0,0.08)" : "none",
                }}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {apiError && <Alert type="error">{apiError}</Alert>}

          {!usersExist && mode === "register" && (
            <Alert type="info">You're setting up the <strong>first account</strong> — this will be the Admin account.</Alert>
          )}

          {mode === "register" && (
            <Input label="Full Name" value={form.name} onChange={set("name")} placeholder="Your full name" required error={errors.name}
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            />
          )}
          <Input label="Email Address" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" required error={errors.email}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>}
          />
          <Input label="Password" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" required error={errors.password}
            hint={mode === "register" ? "Minimum 8 characters" : ""}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
          />
          {mode === "register" && (
            <Input label="Confirm Password" type="password" value={form.confirm} onChange={set("confirm")} placeholder="••••••••" required error={errors.confirm}
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 12 2 2 4-4"/><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
            />
          )}

          <Btn fullWidth size="lg" variant="gold" onClick={handleSubmit} loading={loading} disabled={loading}>
            {mode === "login" ? "Sign In to Dashboard" : "Create Account"}
          </Btn>

          {mode === "login" && (
            <p style={{ textAlign: "center", fontSize: 12, color: ds.slate[400], marginTop: 16 }}>
              Don't have an account?{" "}
              <span style={{ color: ds.emerald[600], cursor: "pointer", fontWeight: 600 }} onClick={() => setMode("register")}>Register here</span>
            </p>
          )}
        </Card>

        <p style={{ textAlign: "center", fontSize: 11, color: `${ds.emerald[200]}60`, marginTop: 16 }}>
          © 2025 Hikmah Business Platform · Secure & Encrypted
        </p>
      </div>
    </div>
  );
};

// --- ONBOARDING: ADD BRANCH ---
const AddBranchPage = ({ onComplete }) => {
  const [form, setForm] = useState({ name: "", address: "", contactNumber: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Branch name is required";
    if (!form.address.trim()) e.address = "Address is required";
    if (!form.contactNumber.trim()) e.contactNumber = "Contact number is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      API.addBranch(form);
      setLoading(false);
      setSuccess(true);
      setTimeout(() => onComplete(), 1200);
    }, 700);
  };

  return (
    <OnboardingShell step={0}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: ds.slate[800], marginBottom: 6, fontFamily: "Georgia, serif" }}>Set Up Your First Branch</div>
          <p style={{ color: ds.slate[400], fontSize: 14 }}>Every business starts somewhere. Add your first location to continue.</p>
        </div>

        {success && <Alert type="success">Branch created successfully! Moving to staff setup...</Alert>}

        <Card style={{ padding: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 20, borderBottom: `1px solid ${ds.slate[100]}` }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: ds.emerald[50], display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ds.emerald[600]} strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: ds.slate[800] }}>Branch Details</div>
              <div style={{ fontSize: 12, color: ds.slate[400] }}>This information appears on staff records and reports</div>
            </div>
          </div>

          <Input label="Branch Name" value={form.name} onChange={set("name")} placeholder="e.g., Main Street Branch" required error={errors.name}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/></svg>}
          />
          <Input label="Location / Address" value={form.address} onChange={set("address")} placeholder="Full street address, city" required error={errors.address}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>}
          />
          <Input label="Contact Number" type="tel" value={form.contactNumber} onChange={set("contactNumber")} placeholder="+1 (555) 000-0000" required error={errors.contactNumber}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.5 12.31 19.79 19.79 0 0 1 1.56 3.7 2 2 0 0 1 3.54 1.5h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.77-1.77a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
          />

          <Btn fullWidth size="lg" variant="gold" onClick={handleSubmit} loading={loading} disabled={loading || success}>
            Create Branch & Continue →
          </Btn>
        </Card>
      </div>
    </OnboardingShell>
  );
};

// --- ONBOARDING: ADD STAFF ---
const AddStaffPage = ({ onComplete }) => {
  const [form, setForm] = useState({ fullName: "", phone: "", emergencyContact: "", branchId: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [pictureData, setPictureData] = useState(null);
  const fileRef = useRef();
  const branches = API.getBranches();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setPreview(ev.target.result); setPictureData(ev.target.result); };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    if (!form.emergencyContact.trim()) e.emergencyContact = "Emergency contact is required";
    if (!form.branchId) e.branchId = "Please assign a branch";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      API.addStaff({ ...form, profilePicture: pictureData });
      API.completeOnboarding();
      setLoading(false);
      onComplete();
    }, 700);
  };

  return (
    <OnboardingShell step={1}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: ds.slate[800], marginBottom: 6, fontFamily: "Georgia, serif" }}>Add Your First Staff Member</div>
          <p style={{ color: ds.slate[400], fontSize: 14 }}>Build your team by registering staff profiles with emergency contacts.</p>
        </div>

        <Card style={{ padding: 32 }}>
          {/* Profile picture upload */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28, paddingBottom: 24, borderBottom: `1px solid ${ds.slate[100]}` }}>
            <div onClick={() => fileRef.current?.click()} style={{ width: 88, height: 88, borderRadius: "50%", background: preview ? "transparent" : ds.slate[100], border: `3px solid ${preview ? ds.emerald[400] : ds.slate[200]}`, cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, transition: "border-color 0.2s", position: "relative" }}>
              {preview ? <img src={preview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (
                <div style={{ textAlign: "center", color: ds.slate[300] }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              )}
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: "50%", background: ds.emerald[500], display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
            <span style={{ fontSize: 12, color: ds.slate[400] }}>Click to upload profile photo (optional)</span>
          </div>

          <Input label="Full Name" value={form.fullName} onChange={set("fullName")} placeholder="Staff member's full name" required error={errors.fullName}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          />
          <Input label="Phone Number" type="tel" value={form.phone} onChange={set("phone")} placeholder="+1 (555) 000-0000" required error={errors.phone}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.5 12.31 19.79 19.79 0 0 1 1.56 3.7 2 2 0 0 1 3.54 1.5h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.77-1.77a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
          />

          {/* Emergency contact - prominent styling */}
          <div style={{ background: "#FFF7ED", border: `1.5px solid ${ds.gold[500]}40`, borderRadius: 12, padding: "16px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ds.gold[600]} strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: ds.gold[700] }}>Emergency Contact</span>
            </div>
            <Input label="Emergency Contact Number" type="tel" value={form.emergencyContact} onChange={set("emergencyContact")} placeholder="Contact for emergencies only" required error={errors.emergencyContact}
              hint="This number is contacted only in urgent situations"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.5 12.31 19.79 19.79 0 0 1 1.56 3.7 2 2 0 0 1 3.54 1.5h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.77-1.77a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
            />
          </div>

          {/* Branch selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: ds.slate[700], marginBottom: 6 }}>Assign to Branch <span style={{ color: ds.gold[600] }}>*</span></label>
            <select value={form.branchId} onChange={set("branchId")}
              style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${errors.branchId ? ds.red[600] : ds.slate[200]}`, borderRadius: 10, fontSize: 14, color: ds.slate[800], background: "white", outline: "none", fontFamily: "inherit" }}
            >
              <option value="">Select a branch…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
            {errors.branchId && <p style={{ fontSize: 12, color: ds.red[600], marginTop: 4 }}>{errors.branchId}</p>}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Btn fullWidth size="lg" variant="gold" onClick={handleSubmit} loading={loading} disabled={loading}>
              Add Staff & Go to Dashboard →
            </Btn>
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: ds.slate[400], marginTop: 12 }}>You can add more staff members from the dashboard at any time.</p>
        </Card>
      </div>
    </OnboardingShell>
  );
};

const OnboardingShell = ({ children, step }) => (
  <div style={{ minHeight: "100vh", background: ds.slate[50], fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity:0; transform:translateY(16px);} to {opacity:1;transform:translateY(0);}}`}</style>
    <div style={{ background: "white", borderBottom: `1px solid ${ds.slate[100]}`, padding: "16px 24px" }}>
      <Logo />
    </div>
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px", animation: "fadeUp 0.4s ease" }}>
      <ProgressStepper steps={["Account Created", "Add Branch", "Add Staff", "Dashboard"]} current={step + 1} />
      {children}
    </div>
  </div>
);

// ============================================================
// DASHBOARD
// ============================================================
const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [branches, setBranches] = useState(API.getBranches());
  const [staff, setStaff] = useState(API.getStaff());
  const [users, setUsers] = useState(API.getAllUsers());
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: "", address: "", contactNumber: "" });
  const [staffForm, setStaffForm] = useState({ fullName: "", phone: "", emergencyContact: "", branchId: "" });
  const [staffPreview, setStaffPreview] = useState(null);
  const [staffPicData, setStaffPicData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const fileRef2 = useRef();

  const refresh = () => { setBranches(API.getBranches()); setStaff(API.getStaff()); setUsers(API.getAllUsers()); };
  const notify = (msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000); };

  const setBF = (k) => (e) => setBranchForm((f) => ({ ...f, [k]: e.target.value }));
  const setSF = (k) => (e) => setStaffForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAddBranch = () => {
    if (!branchForm.name || !branchForm.address || !branchForm.contactNumber) return;
    setModalLoading(true);
    setTimeout(() => { API.addBranch(branchForm); refresh(); setShowAddBranch(false); setBranchForm({ name: "", address: "", contactNumber: "" }); setModalLoading(false); notify("Branch added successfully!"); }, 600);
  };

  const handleAddStaff = () => {
    if (!staffForm.fullName || !staffForm.phone || !staffForm.emergencyContact || !staffForm.branchId) return;
    setModalLoading(true);
    setTimeout(() => { API.addStaff({ ...staffForm, profilePicture: staffPicData }); refresh(); setShowAddStaff(false); setStaffForm({ fullName: "", phone: "", emergencyContact: "", branchId: "" }); setStaffPreview(null); setStaffPicData(null); setModalLoading(false); notify("Staff member added!"); }, 600);
  };

  const handleStaffFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setStaffPreview(ev.target.result); setStaffPicData(ev.target.result); };
    reader.readAsDataURL(file);
  };

  const getBranchName = (id) => branches.find((b) => b._id === id)?.name || "—";

  const tabs = [
    { id: "overview", label: "Overview", icon: "⬡" },
    { id: "branches", label: "Branches", icon: "🏢" },
    { id: "staff", label: "Staff", icon: "👥" },
    ...(user.role === "admin" ? [{ id: "users", label: "Users", icon: "🔐" }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: ds.slate[50], fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes slideIn { from { opacity:0; transform:translateY(-8px);} to {opacity:1;transform:translateY(0);}} @keyframes fadeUp { from { opacity:0; transform:translateY(16px);} to {opacity:1;transform:translateY(0);}}`}</style>

      {/* Toast notification */}
      {notification && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, animation: "slideIn 0.3s ease" }}>
          <Alert type={notification.type}>{notification.msg}</Alert>
        </div>
      )}

      {/* Top Nav */}
      <nav style={{ background: "white", borderBottom: `1px solid ${ds.slate[100]}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <Logo />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: ds.slate[800] }}>{user.name}</div>
            <div style={{ fontSize: 11, color: ds.slate[400] }}>{user.email}</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg, ${ds.emerald[600]}, ${ds.emerald[400]})`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 15 }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <Badge variant={user.role === "admin" ? "admin" : "pending"}>{user.role}</Badge>
          <Btn variant="ghost" size="sm" onClick={onLogout}>Sign out</Btn>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px", animation: "fadeUp 0.4s ease" }}>
        {/* Tab nav */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "white", padding: 6, borderRadius: 12, border: `1px solid ${ds.slate[100]}`, width: "fit-content" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7,
                background: activeTab === t.id ? ds.emerald[700] : "transparent",
                color: activeTab === t.id ? "white" : ds.slate[500],
              }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: ds.slate[800], marginBottom: 4, fontFamily: "Georgia, serif" }}>
                Welcome back, {user.name.split(" ")[0]} 👋
              </h2>
              <p style={{ color: ds.slate[400], fontSize: 14 }}>Here's a snapshot of your Hikmah platform.</p>
            </div>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Total Branches", value: branches.length, icon: "🏢", color: ds.emerald[600], bg: ds.emerald[50] },
                { label: "Staff Members", value: staff.length, icon: "👥", color: "#7C3AED", bg: "#F5F3FF" },
                { label: "Registered Users", value: users.length, icon: "🔐", color: ds.gold[600], bg: "#FFFBEB" },
                { label: "Platform Status", value: "Active", icon: "✅", color: ds.emerald[700], bg: ds.emerald[50] },
              ].map((s, i) => (
                <Card key={i} style={{ padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ fontSize: 12, color: ds.slate[400], fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{s.label}</p>
                      <p style={{ fontSize: 32, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{s.icon}</div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Recent staff */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <Card style={{ padding: 24 }}>
                <div style={{ fontWeight: 700, color: ds.slate[800], marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                  <span>Recent Staff</span>
                  <Btn size="sm" variant="outline" onClick={() => setActiveTab("staff")}>View All</Btn>
                </div>
                {staff.slice(-4).reverse().map((s) => (
                  <div key={s._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${ds.slate[50]}` }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: s.profilePicture ? "transparent" : ds.emerald[100], overflow: "hidden", flexShrink: 0 }}>
                      {s.profilePicture ? <img src={s.profilePicture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: ds.emerald[600] }}>{s.fullName.charAt(0)}</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: ds.slate[800] }}>{s.fullName}</div>
                      <div style={{ fontSize: 11, color: ds.slate[400] }}>{getBranchName(s.branchId)}</div>
                    </div>
                  </div>
                ))}
                {staff.length === 0 && <p style={{ fontSize: 13, color: ds.slate[300], textAlign: "center", padding: 16 }}>No staff added yet</p>}
              </Card>

              <Card style={{ padding: 24 }}>
                <div style={{ fontWeight: 700, color: ds.slate[800], marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                  <span>Branch Locations</span>
                  <Btn size="sm" variant="outline" onClick={() => setActiveTab("branches")}>Manage</Btn>
                </div>
                {branches.map((b) => (
                  <div key={b._id} style={{ padding: "12px 0", borderBottom: `1px solid ${ds.slate[50]}` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: ds.slate[800] }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: ds.slate[400], marginTop: 2 }}>📍 {b.address}</div>
                    <div style={{ fontSize: 11, color: ds.slate[400] }}>📞 {b.contactNumber}</div>
                  </div>
                ))}
                {branches.length === 0 && <p style={{ fontSize: 13, color: ds.slate[300], textAlign: "center", padding: 16 }}>No branches yet</p>}
              </Card>
            </div>
          </div>
        )}

        {/* BRANCHES TAB */}
        {activeTab === "branches" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: ds.slate[800], fontFamily: "Georgia, serif" }}>Branch Management</h2>
                <p style={{ fontSize: 13, color: ds.slate[400] }}>{branches.length} branch{branches.length !== 1 ? "es" : ""} registered</p>
              </div>
              {user.role === "admin" && <Btn variant="gold" onClick={() => setShowAddBranch(true)}>+ Add Branch</Btn>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {branches.map((b) => (
                <Card key={b._id} style={{ padding: 24 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: ds.emerald[50], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ds.emerald[600]} strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: ds.slate[800], fontSize: 15 }}>{b.name}</div>
                      <div style={{ fontSize: 11, color: ds.slate[400], marginTop: 2 }}>Added {new Date(b.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: ds.slate[600] }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      {b.address}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: ds.slate[600] }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.5 12.31"/></svg>
                      {b.contactNumber}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: ds.slate[500] }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      {staff.filter((s) => s.branchId === b._id).length} staff member{staff.filter((s) => s.branchId === b._id).length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </Card>
              ))}
              {branches.length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: ds.slate[300] }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>🏢</p>
                  <p style={{ fontWeight: 600 }}>No branches yet</p>
                  <p style={{ fontSize: 13 }}>Add your first branch to get started</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STAFF TAB */}
        {activeTab === "staff" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: ds.slate[800], fontFamily: "Georgia, serif" }}>Staff Directory</h2>
                <p style={{ fontSize: 13, color: ds.slate[400] }}>{staff.length} staff member{staff.length !== 1 ? "s" : ""} registered</p>
              </div>
              {user.role === "admin" && <Btn variant="gold" onClick={() => setShowAddStaff(true)}>+ Add Staff</Btn>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {staff.map((s) => (
                <Card key={s._id} style={{ padding: 24 }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: s.profilePicture ? "transparent" : `linear-gradient(135deg, ${ds.emerald[400]}, ${ds.emerald[600]})`, overflow: "hidden", flexShrink: 0, border: `3px solid ${ds.emerald[100]}` }}>
                      {s.profilePicture ? <img src={s.profilePicture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "white" }}>{s.fullName.charAt(0)}</div>}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: ds.slate[800], fontSize: 15 }}>{s.fullName}</div>
                      <div style={{ fontSize: 12, color: ds.emerald[600], fontWeight: 600 }}>{getBranchName(s.branchId)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: ds.slate[600] }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/></svg>
                      {s.phone}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: ds.gold[700], background: "#FFF7ED", padding: "6px 10px", borderRadius: 8 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      <strong>Emergency:</strong> {s.emergencyContact}
                    </div>
                  </div>
                </Card>
              ))}
              {staff.length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: ds.slate[300] }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>👥</p>
                  <p style={{ fontWeight: 600 }}>No staff members yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* USERS TAB (Admin only) */}
        {activeTab === "users" && user.role === "admin" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: ds.slate[800], fontFamily: "Georgia, serif" }}>User Accounts</h2>
              <p style={{ fontSize: 13, color: ds.slate[400] }}>Manage platform access and roles</p>
            </div>

            <Card>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${ds.slate[100]}` }}>
                    {["User", "Email", "Role", "Joined"].map((h) => (
                      <th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: ds.slate[400], letterSpacing: "0.07em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} style={{ borderBottom: `1px solid ${ds.slate[50]}` }}>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${ds.emerald[500]}, ${ds.emerald[700]})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white" }}>{u.name.charAt(0)}</div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: ds.slate[800] }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 13, color: ds.slate[500] }}>{u.email}</td>
                      <td style={{ padding: "14px 20px" }}><Badge variant={u.role === "admin" ? "admin" : "pending"}>{u.role}</Badge></td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: ds.slate[400] }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div style={{ marginTop: 16, padding: "14px 16px", background: ds.emerald[50], borderRadius: 10, fontSize: 13, color: ds.emerald[800], display: "flex", gap: 8 }}>
              <span>ℹ️</span>
              <div><strong>Role Logic:</strong> The first registered account receives the Admin role automatically. All subsequent users are marked "Pending" until a role management system is integrated.</div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Add Branch */}
      {showAddBranch && (
        <Modal title="Add New Branch" onClose={() => setShowAddBranch(false)}>
          <Input label="Branch Name" value={branchForm.name} onChange={setBF("name")} placeholder="e.g., Downtown Branch" required />
          <Input label="Address" value={branchForm.address} onChange={setBF("address")} placeholder="Full street address" required />
          <Input label="Contact Number" type="tel" value={branchForm.contactNumber} onChange={setBF("contactNumber")} placeholder="+1 (555) 000-0000" required />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowAddBranch(false)}>Cancel</Btn>
            <Btn variant="gold" onClick={handleAddBranch} loading={modalLoading}>Create Branch</Btn>
          </div>
        </Modal>
      )}

      {/* MODAL: Add Staff */}
      {showAddStaff && (
        <Modal title="Add Staff Member" onClose={() => setShowAddStaff(false)}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div onClick={() => fileRef2.current?.click()} style={{ width: 64, height: 64, borderRadius: "50%", background: staffPreview ? "transparent" : ds.slate[100], border: `2px dashed ${ds.slate[300]}`, cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {staffPreview ? <img src={staffPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ds.slate[300]} strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            </div>
            <input ref={fileRef2} type="file" accept="image/*" onChange={handleStaffFile} style={{ display: "none" }} />
            <div style={{ fontSize: 12, color: ds.slate[400] }}>Click avatar to upload<br/>profile photo (optional)</div>
          </div>
          <Input label="Full Name" value={staffForm.fullName} onChange={setSF("fullName")} placeholder="Staff member's full name" required />
          <Input label="Phone Number" type="tel" value={staffForm.phone} onChange={setSF("phone")} placeholder="+1 (555) 000-0000" required />
          <div style={{ background: "#FFF7ED", border: `1px solid ${ds.gold[500]}40`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ds.gold[700], marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}><span>⚠️</span> Emergency Contact</div>
            <Input label="" value={staffForm.emergencyContact} onChange={setSF("emergencyContact")} placeholder="Emergency phone number" required hint="Only contacted during urgent situations" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: ds.slate[700], marginBottom: 6 }}>Assign Branch <span style={{ color: ds.gold[600] }}>*</span></label>
            <select value={staffForm.branchId} onChange={setSF("branchId")} style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${ds.slate[200]}`, borderRadius: 10, fontSize: 14, color: ds.slate[800], background: "white", fontFamily: "inherit" }}>
              <option value="">Select a branch…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowAddStaff(false)}>Cancel</Btn>
            <Btn variant="gold" onClick={handleAddStaff} loading={modalLoading}>Add Staff Member</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Modal = ({ title, children, onClose }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }} onClick={onClose}>
    <Card style={{ padding: "28px 32px", maxWidth: 500, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h3 style={{ fontWeight: 800, color: ds.slate[800], fontSize: 17, margin: 0, fontFamily: "Georgia, serif" }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: ds.slate[400], fontSize: 20, lineHeight: 1 }}>×</button>
      </div>
      {children}
    </Card>
  </div>
);

// ============================================================
// PENDING USER PAGE
// ============================================================
const PendingPage = ({ user, onLogout }) => (
  <div style={{ minHeight: "100vh", background: ds.slate[50], display: "flex", flexDirection: "column", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
    <nav style={{ background: "white", borderBottom: `1px solid ${ds.slate[100]}`, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Logo /><Btn variant="ghost" size="sm" onClick={onLogout}>Sign out</Btn>
    </nav>
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Card style={{ padding: 48, maxWidth: 440, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 30 }}>⏳</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: ds.slate[800], marginBottom: 8, fontFamily: "Georgia, serif" }}>Account Pending Approval</h2>
        <p style={{ color: ds.slate[500], fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Your account has been created successfully. A platform administrator will review and approve your access shortly.
        </p>
        <div style={{ background: ds.slate[50], borderRadius: 10, padding: "16px", textAlign: "left", marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: ds.slate[400], marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Registered as</div>
          <div style={{ fontWeight: 700, color: ds.slate[800] }}>{user.name}</div>
          <div style={{ fontSize: 13, color: ds.slate[500] }}>{user.email}</div>
          <div style={{ marginTop: 8 }}><Badge variant="pending">Pending</Badge></div>
        </div>
        <Btn variant="outline" onClick={onLogout} fullWidth>Sign Out</Btn>
      </Card>
    </div>
  </div>
);

// ============================================================
// APP ROOT — Routing & State Machine
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [appState, setAppState] = useState("loading"); // loading | auth | onboard-branch | onboard-staff | pending | dashboard

  useEffect(() => {
    const currentUser = API.getCurrentUser();
    if (!currentUser) { setAppState("auth"); return; }
    determineState(currentUser);
  }, []);

  const determineState = (u) => {
    setUser(u);
    if (u.role === "admin" && !u.onboardingComplete) {
      const hasBranches = API.getBranches().length > 0;
      setAppState(hasBranches ? "onboard-staff" : "onboard-branch");
    } else if (u.role === "pending") {
      setAppState("pending");
    } else {
      setAppState("dashboard");
    }
  };

  const handleAuth = (u) => { setUser(u); determineState(u); };
  const handleLogout = () => { API.logout(); setUser(null); setAppState("auth"); };
  const handleBranchDone = () => setAppState("onboard-staff");
  const handleStaffDone = () => { const u = API.getCurrentUser(); setUser(u); setAppState("dashboard"); };

  if (appState === "loading") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: ds.emerald[900] }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ textAlign: "center" }}>
        <Logo size="lg" />
        <div style={{ marginTop: 24 }}><Spinner size={32} color={ds.emerald[400]} /></div>
      </div>
    </div>
  );

  if (appState === "auth") return <AuthPage onAuth={handleAuth} />;
  if (appState === "onboard-branch") return <AddBranchPage onComplete={handleBranchDone} />;
  if (appState === "onboard-staff") return <AddStaffPage onComplete={handleStaffDone} />;
  if (appState === "pending") return <PendingPage user={user} onLogout={handleLogout} />;
  if (appState === "dashboard") return <Dashboard user={user} onLogout={handleLogout} />;
  return null;
}
