import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileCheck,
  FileUp,
  History,
  ImageDown,
  Lock,
  LogOut,
  Mail,
  PenLine,
  Play,
  Search,
  Settings,
  Shield,
  Trash2,
  Upload,
  UserCircle,
  Users,
  X
} from "lucide-react";
import prepVaultLogo from "./assets/prepvault-logo.png";
import "./styles.css";

const API = import.meta.env.VITE_API_BASE ?? "/api";
const BROWSE_PREVIEW_LENGTH = 200;
type Role = "ADMIN" | "STUDENT";
type UserStatus = "ACTIVE" | "INACTIVE";
type Answer = "A" | "B" | "C" | "D";
type User = { id: string; name: string; username: string; role: Role; status?: UserStatus };
type Question = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: Answer;
  explanation?: string;
  topic?: string;
  syllabus?: string;
  category?: string;
  import?: { label: string; createdAt: string };
};
type ImportRow = {
  id: string;
  label: string;
  questionCount: number;
  rowCount?: number;
  checksum?: string;
  syllabus?: string | null;
  questionType?: string | null;
  status: "ACTIVE" | "INACTIVE";
  owner?: { id: string; username: string; name?: string };
};
type ValidationResult =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "valid"; rowCount: number; questionCount: number; checksum: string }
  | { status: "invalid"; errors: string[] };
type ImportSuccess = { questionCount: number; rowCount: number; label: string };
type Session = { user: User; effectiveUser: User; emulating: boolean };
type MockAttempt = {
  id: string;
  requestedQuestionCount: number;
  durationMinutes: number;
  extensionUsed: boolean;
  startedAt: string;
  submittedAt?: string | null;
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  scorePercent: number;
  topics?: string[];
  questions: Array<{
    questionId: string;
    displayOrder: number;
    selectedAnswer?: Answer | null;
    isCorrect?: boolean | null;
    question: Question;
  }>;
};
type QuestionsResponse = {
  questions: Question[];
  totalCount: number;
  activeImportCount: number;
};
type CreateUserForm = { name: string; username: string; password: string; role: Role };
type CreateUserErrors = Partial<Record<keyof CreateUserForm, string>>;

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error?.message ?? "Request failed");
    (error as Error & { details?: unknown }).details = data.error?.details;
    throw error;
  }
  return data;
}

function optionValue(question: Question, key: Answer) {
  return question[`option${key}` as keyof Question] as string;
}

function questionPreview(questionText: string) {
  return questionText.length > BROWSE_PREVIEW_LENGTH
    ? `${questionText.slice(0, BROWSE_PREVIEW_LENGTH).trimEnd()}...`
    : questionText;
}

function isTctLabel(label: string) {
  return label.toUpperCase().includes("TCT");
}

function validateCreateUserForm(form: CreateUserForm) {
  const errors: CreateUserErrors = {};
  if (!form.name.trim()) errors.name = "Name is required.";
  if (!form.username.trim()) errors.username = "Email is required.";
  else if (form.username.trim().length < 3) errors.username = "Email must be at least 3 characters.";
  if (!form.password) errors.password = "Temporary password is required.";
  else if (form.password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (!form.role) errors.role = "Role is required.";
  return errors;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("admin@example.com");
  const [password, setPassword] = useState("AdminPass123!");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <main className="login">
      <form className="login-panel" onSubmit={submit} noValidate>
        <div className="brand-block">
          <img className="login-logo" src={prepVaultLogo} alt="PrepVault" />
          <div className="login-copy">
            <h1>Welcome back</h1>
            <p>Sign in to continue to PrepVault</p>
          </div>
        </div>
        <div className="login-form-fields">
          <div className="login-field">
            <label htmlFor="login-username">Email or Username</label>
            <div className="login-input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input
                id="login-username"
                autoComplete="username"
                placeholder="Enter your email or username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <div className="login-input-wrap">
              <Lock size={18} aria-hidden="true" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={error ? "login-error" : undefined}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>
        <div className="login-options">
          <label className="remember-option" htmlFor="remember-me">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
          <span className="forgot-password disabled" aria-disabled="true" title="Password reset is not available yet">
            Forgot password?
          </span>
        </div>
        {error && (
          <p className="login-alert" id="login-error" role="alert">
            {error}
          </p>
        )}
        <button className="login-submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        <p className="login-footer">Powered by Nexio Labs</p>
      </form>
    </main>
  );
}

function Admin({ refresh }: { refresh: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [metadataSearch, setMetadataSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateUserForm>({ name: "", username: "", password: "", role: "STUDENT" });
  const [formErrors, setFormErrors] = useState<CreateUserErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", username: "", role: "STUDENT" as Role, status: "ACTIVE" as UserStatus, password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");

  const load = async () => {
    const [userData, importData] = await Promise.all([
      api<{ users: User[] }>("/admin/users"),
      api<{ imports: ImportRow[] }>("/admin/imports")
    ]);
    setUsers(userData.users);
    setImports(importData.imports);
  };
  useEffect(() => { load().catch((err) => setError(err instanceof Error ? err.message : "Could not load admin data")); }, []);
  useEffect(() => {
    if (users.length === 0) {
      setSelectedUserId(null);
      return;
    }
    setSelectedUserId((current) => {
      if (current && users.some((user) => user.id === current)) return current;
      return users.find((user) => user.role === "STUDENT")?.id ?? users[0].id;
    });
  }, [users]);

  const filteredUsers = useMemo(() => {
    const normalized = userSearch.trim().toLowerCase();
    return users.filter((user) => {
      if (!normalized) return true;
      return [user.name, user.username, user.role, user.status]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });
  }, [users, userSearch]);

  const selectedUser = users.find((user) => user.id === selectedUserId);
  const selectedImports = imports.filter((item) => item.owner?.id === selectedUserId);
  const activeImportTotal = selectedImports.filter((item) => item.status === "ACTIVE").length;
  const questionTotal = selectedImports.reduce((total, item) => total + item.questionCount, 0);
  const filteredImports = useMemo(() => {
    const normalized = metadataSearch.trim().toLowerCase();
    return imports.filter((item) => {
      if (item.owner?.id !== selectedUserId) return false;
      if (!normalized) return true;
      return [item.label, item.status, item.syllabus, item.questionType, item.owner?.username]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });
  }, [imports, metadataSearch, selectedUserId]);

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const nextErrors = validateCreateUserForm(form);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || isCreating) return;
    setIsCreating(true);
    try {
      await api("/admin/users", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", username: "", password: "", role: "STUDENT" });
      setFormErrors({});
      setMessage("User created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user");
    } finally {
      setIsCreating(false);
    }
  }

  async function setImportStatus(id: string, status: "ACTIVE" | "INACTIVE") {
    setError("");
    setMessage("");
    try {
      await api(`/admin/imports/${id}/${status === "ACTIVE" ? "activate" : "inactivate"}`, { method: "POST" });
      setMessage(status === "ACTIVE" ? "Import activated." : "Import inactivated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update import");
    }
  }

  function openEdit(user: User) {
    setEditing(user);
    setEditForm({
      name: user.name,
      username: user.username,
      role: user.role,
      status: user.status ?? "ACTIVE",
      password: ""
    });
    setDialogError("");
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setDialogError("");
    try {
      await api(`/admin/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          username: editForm.username,
          role: editForm.role,
          status: editForm.status
        })
      });
      if (editForm.password) {
        await api(`/admin/users/${editing.id}/reset-password`, {
          method: "POST",
          body: JSON.stringify({ password: editForm.password })
        });
      }
      setEditing(null);
      setMessage("User updated.");
      await load();
      refresh();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Could not update user");
    }
  }

  async function emulate(id: string) {
    await api(`/admin/emulation/${id}/start`, { method: "POST" });
    refresh();
  }

  return (
    <section className="workspace admin-workspace">
      <div className="panel data-panel admin-users-panel">
        <h2><Users size={18} /> Users</h2>
        <form className="grid-form user-create-form" onSubmit={createUser}>
          <label className="form-field">
            <input
              placeholder="Name"
              value={form.name}
              aria-invalid={Boolean(formErrors.name)}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
              }}
            />
            {formErrors.name && <small className="field-error">{formErrors.name}</small>}
          </label>
          <label className="form-field">
            <input
              placeholder="Email"
              value={form.username}
              aria-invalid={Boolean(formErrors.username)}
              onChange={(e) => {
                setForm({ ...form, username: e.target.value });
                if (formErrors.username) setFormErrors({ ...formErrors, username: undefined });
              }}
            />
            {formErrors.username && <small className="field-error">{formErrors.username}</small>}
          </label>
          <label className="form-field">
            <input
              placeholder="Temporary password"
              type="password"
              value={form.password}
              aria-invalid={Boolean(formErrors.password)}
              onChange={(e) => {
                setForm({ ...form, password: e.target.value });
                if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
              }}
            />
            {formErrors.password && <small className="field-error">{formErrors.password}</small>}
          </label>
          <label className="form-field">
            <select
              value={form.role}
              aria-invalid={Boolean(formErrors.role)}
              onChange={(e) => {
                setForm({ ...form, role: e.target.value as Role });
                if (formErrors.role) setFormErrors({ ...formErrors, role: undefined });
              }}
            >
              <option>STUDENT</option><option>ADMIN</option>
            </select>
            {formErrors.role && <small className="field-error">{formErrors.role}</small>}
          </label>
          <button disabled={isCreating}>{isCreating ? "Creating..." : "Create"}</button>
        </form>
        {message && <p className="ok">{message}</p>}
        {error && <p className="error">{error}</p>}
        <div className="admin-search-row">
          <input
            aria-label="Search users"
            placeholder="Search users"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
        </div>
        <div className="table">
          {filteredUsers.map((user) => (
            <div
              className={`row selectable user-row ${selectedUserId === user.id ? "selected" : ""}`}
              key={user.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedUserId(user.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedUserId(user.id);
                }
              }}
            >
              <span>{user.name}<small>{user.username}</small></span>
              <span>{user.role}<small>{user.status ?? "ACTIVE"}</small></span>
              <div className="row-actions">
                <button className="icon-button ghost" title="Edit user" aria-label={`Edit ${user.name}`} onClick={(event) => { event.stopPropagation(); openEdit(user); }}>
                  <PenLine size={16} />
                </button>
                {user.role === "STUDENT" && (
                  <button
                    className="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      emulate(user.id);
                    }}
                  >
                    <Eye size={16} /> Emulate
                  </button>
                )}
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && <p className="muted">No users match this search.</p>}
        </div>
      </div>
      <div className="panel data-panel admin-metadata-panel">
        <h2><FileUp size={18} /> Import Metadata</h2>
        <div className="metadata-summary">
          <div>
            <b>{selectedUser ? selectedUser.name : "No user selected"}</b>
            <small>{selectedUser ? selectedUser.username : "Select a user to view imports."}</small>
          </div>
          <div><b>{selectedImports.length}</b><small>imports</small></div>
          <div><b>{activeImportTotal}</b><small>active</small></div>
          <div><b>{questionTotal}</b><small>questions</small></div>
        </div>
        <div className="admin-search-row">
          <input
            aria-label="Search import metadata"
            placeholder="Search import metadata"
            value={metadataSearch}
            onChange={(e) => setMetadataSearch(e.target.value)}
          />
        </div>
        <div className="table">
          {filteredImports.map((item) => (
            <div className="row metadata-row" key={item.id}>
              <span>
                <span className={isTctLabel(item.label) ? "import-label tct-label" : "import-label"}>{item.label}</span>
                <small>
                  {[
                    item.owner?.username,
                    `${item.questionCount} questions`,
                    item.rowCount === undefined ? "Rows unknown" : `${item.rowCount} rows`,
                    item.syllabus || "No syllabus",
                    item.questionType || "No type"
                  ].filter(Boolean).join(" | ")}
                </small>
              </span>
              <span>{item.status}</span>
              {item.status === "ACTIVE" ? (
                <button className="ghost" onClick={() => setImportStatus(item.id, "INACTIVE")}>Inactivate</button>
              ) : (
                <button className="ghost" onClick={() => setImportStatus(item.id, "ACTIVE")}>Activate</button>
              )}
            </div>
          ))}
          {selectedUserId && filteredImports.length === 0 && <p className="muted">No imports match this user and search.</p>}
        </div>
      </div>
      {editing && (
        <div className="modal-backdrop" role="presentation">
          <form className="panel modal" onSubmit={saveEdit} role="dialog" aria-modal="true" aria-label="Edit user">
            <div className="modal-header">
              <h2><PenLine size={18} /> Edit User</h2>
              <button type="button" className="icon-button ghost" title="Close" aria-label="Close" onClick={() => setEditing(null)}><X size={16} /></button>
            </div>
            <div className="dialog-grid">
              <label>Name<input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
              <label>Email<input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} /></label>
              <label>Role<select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}><option>STUDENT</option><option>ADMIN</option></select></label>
              <label>Status<select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as UserStatus })}><option>ACTIVE</option><option>INACTIVE</option></select></label>
              <label className="full-field">Reset password<input type="password" placeholder="Leave blank to keep password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} /></label>
            </div>
            {dialogError && <p className="error">{dialogError}</p>}
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button>Save</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function Profile({ session, refresh, onLoggedOut }: { session: Session; refresh: () => void; onLoggedOut: () => void }) {
  const [account, setAccount] = useState({ name: session.user.name, username: session.user.username });
  const [password, setPassword] = useState("");
  const [passwordMode, setPasswordMode] = useState<"stay" | "logout">("stay");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setAccount({ name: session.user.name, username: session.user.username });
  }, [session.user.name, session.user.username]);

  async function saveAccount(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await api("/profile", { method: "PATCH", body: JSON.stringify(account) });
      setMessage("Profile updated.");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile");
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const data = await api<{ ok: true; loggedIn: boolean }>("/profile/password", {
        method: "POST",
        body: JSON.stringify({
          password,
          logoutAllDevices: true,
          stayLoggedIn: passwordMode === "stay"
        })
      });
      setPassword("");
      if (!data.loggedIn) {
        onLoggedOut();
        return;
      }
      setMessage("Password updated.");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    }
  }

  return (
    <section className="profile-layout">
      <form className="panel profile-panel" onSubmit={saveAccount}>
        <h2><UserCircle size={18} /> Profile</h2>
        <label>Name<input value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} /></label>
        <label>Email<input value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} /></label>
        <button>Save profile</button>
      </form>
      <form className="panel profile-panel" onSubmit={changePassword}>
        <h2><Shield size={18} /> Password</h2>
        <label>New password<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <div className="segmented" role="group" aria-label="Password session handling">
          <button type="button" className={passwordMode === "stay" ? "active" : ""} onClick={() => setPasswordMode("stay")}>Stay logged in</button>
          <button type="button" className={passwordMode === "logout" ? "active" : ""} onClick={() => setPasswordMode("logout")}>Log out all devices</button>
        </div>
        <button disabled={!password}>Update password</button>
      </form>
      {(message || error) && <div className={error ? "errorbox profile-message" : "okbox profile-message"}>{error || message}</div>}
    </section>
  );
}

function Imports() {
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [label, setLabel] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [validation, setValidation] = useState<ValidationResult>({ status: "idle" });
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importSuccess, setImportSuccess] = useState<ImportSuccess | null>(null);
  const selectedFileName = file?.name ?? "";
  const statusLabel = isImporting
    ? "Importing questions..."
    : validation.status === "valid"
      ? "File validated successfully"
      : validation.status === "invalid"
        ? "Validation failed - review the issues below"
        : file
          ? "Ready to validate"
          : "No file selected";

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    clearValidation();
  }

  function buildFormData() {
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    data.append("label", label || file.name);
    if (syllabus) data.append("syllabus", syllabus);
    if (questionType) data.append("questionType", questionType);
    return data;
  }

  function clearValidation() {
    setValidation({ status: "idle" });
    setError("");
    setImportSuccess(null);
  }

  function clearImportForm(nextSuccess: ImportSuccess | null = null) {
    setFile(null);
    setLabel("");
    setSyllabus("");
    setQuestionType("");
    setValidation({ status: "idle" });
    setError("");
    setImportSuccess(nextSuccess);
    setFileInputKey((key) => key + 1);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (isImporting) return;
    const nextFile = event.dataTransfer.files?.[0] ?? null;
    if (nextFile) selectFile(nextFile);
  }

  async function validateFile() {
    const data = buildFormData();
    if (!data || isImporting) return;
    setError("");
    setImportSuccess(null);
    setValidation({ status: "validating" });
    try {
      const result = await api<
        | { valid: true; rowCount: number; questionCount: number; checksum: string }
        | { valid: false; errors: string[] }
      >("/imports/validate", { method: "POST", body: data });
      setValidation(result.valid
        ? { status: "valid", rowCount: result.rowCount, questionCount: result.questionCount, checksum: result.checksum }
        : { status: "invalid", errors: result.errors });
    } catch (err) {
      setValidation({ status: "invalid", errors: [err instanceof Error ? err.message : "Validation failed"] });
    }
  }

  async function uploadFile(event: React.FormEvent) {
    event.preventDefault();
    const data = buildFormData();
    if (!data || validation.status !== "valid" || isImporting) return;
    setError("");
    setImportSuccess(null);
    setIsImporting(true);
    try {
      const result = await api<{ import: ImportRow }>("/imports", { method: "POST", body: data });
      clearImportForm({
        questionCount: result.import.questionCount,
        rowCount: result.import.rowCount ?? validation.rowCount,
        label: result.import.label
      });
    } catch (err) {
      const details = err instanceof Error ? (err as Error & { details?: unknown }).details : undefined;
      const detailMessage = Array.isArray(details) ? details.join("\n") : "";
      setError([err instanceof Error ? err.message : "Upload failed", detailMessage].filter(Boolean).join("\n"));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="app-page imports-page">
      <div className="page-header">
        <div>
          <h1><Upload size={24} /> Imports</h1>
          <p>Import questions into your PrepVault question bank from an Excel file.</p>
        </div>
        <button type="button" className="button-outline" disabled={isImporting} onClick={() => { window.location.href = `${API}/imports/template`; }}>
          <Download size={16} /> Download sample
        </button>
      </div>
      <form className="import-card" onSubmit={uploadFile}>
        <div className="workflow-steps" aria-label="Import workflow">
          <span className={file ? "complete" : "active"}>1. Select file</span>
          <span className={file ? "active" : ""}>2. Add details</span>
          <span className={validation.status === "valid" ? "complete" : file ? "active" : ""}>3. Validate</span>
          <span className={validation.status === "valid" ? "active" : ""}>4. Import</span>
        </div>

        <section className="import-section">
          <h2>1. Select file</h2>
          <input
            ref={fileInputRef}
            key={fileInputKey}
            className="visually-hidden"
            type="file"
            accept=".xlsx,.xls"
            disabled={isImporting}
            onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="selected-file">
              <div className="file-icon" aria-hidden="true"><FileCheck size={22} /></div>
              <div>
                <b>{file.name}</b>
                <small>{formatFileSize(file.size)} | XLSX / XLS file</small>
              </div>
              <div className="selected-file-actions">
                <button type="button" className="button-outline compact" disabled={isImporting} onClick={() => fileInputRef.current?.click()}>
                  Change
                </button>
                <button type="button" className="icon-text-button" disabled={isImporting} onClick={() => clearImportForm()}>
                  <Trash2 size={15} /> Remove file
                </button>
              </div>
            </div>
          ) : (
            <div
              className={isDragging ? "upload-zone dragging" : "upload-zone"}
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!isImporting) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="upload-zone-icon" aria-hidden="true"><Upload size={24} /></div>
              <b>Upload question file</b>
              <p>Drag and drop your Excel file here or browse from your device.</p>
              <span className="browse-file-button">Browse file</span>
              <small>XLSX / XLS files supported</small>
            </div>
          )}
        </section>

        <section className="import-section">
          <h2>2. Import details</h2>
          <div className="import-details-grid">
            <label htmlFor="import-label">
              Import label
              <input
                id="import-label"
                placeholder="e.g. Java Fundamentals - September 2026"
                value={label}
                disabled={isImporting}
                onChange={(e) => { setLabel(e.target.value); clearValidation(); }}
              />
              <small>Used to identify this imported question set.</small>
            </label>
            <label htmlFor="import-syllabus">
              Syllabus
              <input
                id="import-syllabus"
                placeholder="e.g. Core Java"
                value={syllabus}
                disabled={isImporting}
                onChange={(e) => { setSyllabus(e.target.value); clearValidation(); }}
              />
            </label>
            <label className="wide-field" htmlFor="import-question-type">
              Question type
              <input
                id="import-question-type"
                placeholder="e.g. Multiple choice"
                value={questionType}
                disabled={isImporting}
                onChange={(e) => { setQuestionType(e.target.value); clearValidation(); }}
              />
            </label>
          </div>
        </section>

        {isImporting && <div className="progress import-progress" aria-label="Import in progress"><span /></div>}
        {validation.status === "valid" && (
          <div className="validation-panel success" role="status">
            <div><CheckCircle2 size={18} /><b>File validated successfully</b></div>
            <p>{validation.questionCount} questions ready to import from {validation.rowCount} rows.</p>
            <dl className="summary-list">
              <div><dt>File</dt><dd>{selectedFileName}</dd></div>
              <div><dt>Checksum</dt><dd>{validation.checksum}</dd></div>
            </dl>
          </div>
        )}
        {validation.status === "invalid" && (
          <div className="validation-panel danger" role="alert">
            <div><AlertCircle size={18} /><b>Validation issues</b></div>
            <p>{validation.errors.length} {validation.errors.length === 1 ? "issue" : "issues"} found.</p>
            <ul>{validation.errors.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
          </div>
        )}
        {importSuccess && (
          <div className="validation-panel success" role="status">
            <div><CheckCircle2 size={18} /><b>Import completed</b></div>
            <p>Imported {importSuccess.questionCount} questions from {importSuccess.rowCount} rows.</p>
          </div>
        )}
        {error && <pre className="validation-panel danger import-error" role="alert">{error}</pre>}

        <div className="import-action-bar">
          <div className="import-status" aria-live="polite">
            <span className={validation.status === "valid" ? "status-dot success" : validation.status === "invalid" ? "status-dot danger" : "status-dot"} />
            {statusLabel}
          </div>
          <div className="import-actions">
            <button type="button" className="button-secondary" disabled={isImporting} onClick={() => clearImportForm()}>
              <X size={16} /> Clear
            </button>
            <button type="button" className="button-secondary" disabled={!file || validation.status === "validating" || isImporting} onClick={validateFile}>
              <FileCheck size={16} /> {validation.status === "validating" ? "Validating..." : "Validate file"}
            </button>
            <button className="button-primary" disabled={validation.status !== "valid" || isImporting}>
              <Upload size={16} /> {isImporting ? "Importing..." : "Import questions"}
            </button>
          </div>
        </div>
      </form>
      <p className="app-footer">Powered by Nexio Labs</p>
    </section>
  );
}

function Configuration() {
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [active, setActive] = useState<string[]>([]);
  const [error, setError] = useState("");
  const load = async () => {
    const data = await api<{ imports: ImportRow[]; activeImportIds: string[] }>("/imports");
    setImports(data.imports);
    setActive(data.activeImportIds);
  };
  useEffect(() => { load(); }, []);
  async function saveActive(next: string[]) {
    setError("");
    setActive(next);
    try {
      await api("/imports/active", { method: "PUT", body: JSON.stringify({ importIds: next }) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save configuration");
      load();
    }
  }
  const activeImports = imports.filter((item) => item.status === "ACTIVE");
  const selectedQuestionCount = activeImports
    .filter((item) => active.includes(item.id))
    .reduce((total, item) => total + item.questionCount, 0);

  return (
    <section className="panel data-panel configuration-panel">
      <h2><Settings size={18} /> Configuration</h2>
      <p className="meta">{active.length} active imports selected | {selectedQuestionCount} active questions</p>
      {error && <p className="error">{error}</p>}
      <div className="table">
        {activeImports.map((item) => (
          <div className="row" key={item.id}>
            <label className="checkline">
              <input
                type="checkbox"
                checked={active.includes(item.id)}
                onChange={(e) =>
                  saveActive(e.target.checked ? [...active, item.id] : active.filter((id) => id !== item.id))
                }
              />
              <span><span className={isTctLabel(item.label) ? "import-label tct-label" : "import-label"}>{item.label}</span><small>{item.questionCount} questions | {item.syllabus || "No syllabus"} | {item.questionType || "No type"}</small></span>
            </label>
          </div>
        ))}
        {activeImports.length === 0 && <p className="muted">No active imports are available.</p>}
      </div>
    </section>
  );
}

function Browse() {
  const [search, setSearch] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [activeImportCount, setActiveImportCount] = useState(0);
  const [selected, setSelected] = useState<Question | null>(null);
  useEffect(() => {
    const timeout = setTimeout(() => {
      api<QuestionsResponse>(`/questions?search=${encodeURIComponent(search)}`).then((data) => {
        setQuestions(data.questions);
        setTotalCount(data.totalCount);
        setActiveImportCount(data.activeImportCount);
      });
    }, 200);
    return () => clearTimeout(timeout);
  }, [search]);
  const questionLabel = totalCount === 1 ? "question" : "questions";
  const courseLabel = activeImportCount === 1 ? "course configured" : "courses configured";
  return (
    <section className="split">
      <div className="panel data-panel browse-list-panel">
        <div className="browse-header">
          <h2><Search size={30} /> Browse</h2>
          <p className="browse-stats">
            Showing {totalCount.toLocaleString()} {questionLabel} | {activeImportCount.toLocaleString()} {courseLabel}
          </p>
        </div>
        <input placeholder="Search active questions" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="list">
          {questions.map((q) => (
            <button
              className={`list-item ${selected?.id === q.id ? "selected" : ""}`}
              key={q.id}
              onClick={() => setSelected(q)}
            >
              {questionPreview(q.questionText)}
            </button>
          ))}
        </div>
      </div>
      <QuestionDetail question={selected} />
    </section>
  );
}

function QuestionDetail({ question }: { question: Question | null }) {
  if (!question) return <div className="panel data-panel question-detail-panel muted">Select a question.</div>;
  return (
    <div className="panel data-panel question-detail-panel">
      <h2><BookOpen size={18} /> Detail</h2>
      <div className="question-detail-scroll">
        <p className="question">{question.questionText}</p>
        <div className="answer-rows">
          {(["A", "B", "C", "D"] as const).map((key) => (
            <div key={key} className={question.correctAnswer === key ? "answer-row correct" : "answer-row"}>
              <b>{key}</b>
              <span>{optionValue(question, key)}</span>
            </div>
          ))}
        </div>
        <p><b>Explanation:</b> {question.explanation || "Not provided"}</p>
        <p className="meta">{[question.topic, question.category, question.syllabus, question.import?.label].filter(Boolean).join(" | ")}</p>
      </div>
    </div>
  );
}

function Practice() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctAnswer: Answer; explanation?: string } | null>(null);
  const [history, setHistory] = useState<Question[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, Answer>>({});
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const isLoadingNextRef = useRef(false);

  async function loadNext() {
    setFeedback(null);
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setQuestion(history[nextIndex]);
      return;
    }
    if (isLoadingNextRef.current) return;

    isLoadingNextRef.current = true;
    setIsLoadingNext(true);
    try {
      const data = await api<{ question: Question }>("/practice/next");
      setHistory((current) => [...current, data.question]);
      setHistoryIndex((index) => index + 1);
      setQuestion(data.question);
    } finally {
      isLoadingNextRef.current = false;
      setIsLoadingNext(false);
    }
  }

  function loadPrevious() {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setFeedback(null);
    setHistoryIndex(nextIndex);
    setQuestion(history[nextIndex]);
  }

  useEffect(() => { loadNext().catch(() => undefined); }, []);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement
        && (target.isContentEditable || Boolean(target.closest("input, textarea, select, [contenteditable='true']")))
      ) return;

      if (event.key === "ArrowLeft" && historyIndex > 0) {
        event.preventDefault();
        loadPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        loadNext().catch(() => undefined);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  async function answer(answerValue: Answer) {
    if (!question) return;
    setSelectedAnswers((current) => ({ ...current, [question.id]: answerValue }));
    const data = await api<{ isCorrect: boolean; correctAnswer: Answer; explanation?: string }>(`/practice/${question.id}/answer`, { method: "POST", body: JSON.stringify({ answer: answerValue }) });
    setFeedback(data);
  }

  return (
    <section className="panel practice-panel">
      <h2><Play size={18} /> Practice</h2>
      {question ? <>
        <div className="practice-content">
          <div className="practice-card">
            <p className="question practice-question">{question.questionText}</p>
            <div className="answers">{(["A", "B", "C", "D"] as const).map((key) => (
              <button
                className={selectedAnswers[question.id] === key ? "practice-answer selected" : "practice-answer"}
                key={key}
                aria-pressed={selectedAnswers[question.id] === key}
                onClick={() => answer(key)}
              >
                {key}. {optionValue(question, key)}
              </button>
            ))}</div>
            {feedback && <div className={feedback.isCorrect ? "feedback okbox" : "feedback errorbox"}><b>{feedback.isCorrect ? "Correct" : "Incorrect"}</b><p>Correct answer: {feedback.correctAnswer}</p><p>{feedback.explanation}</p></div>}
          </div>
        </div>
        <div className="practice-nav">
          <button className="ghost" disabled={historyIndex <= 0} onClick={loadPrevious}><ArrowLeft size={17} aria-hidden="true" /> Previous</button>
          <button className="ghost" disabled={isLoadingNext} onClick={() => loadNext().catch(() => undefined)}>Next <ArrowRight size={17} aria-hidden="true" /></button>
        </div>
      </> : <p className="muted">No active questions.</p>}
    </section>
  );
}

function MockTests() {
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(10);
  const [attempt, setAttempt] = useState<MockAttempt | null>(null);
  const [history, setHistory] = useState<MockAttempt[]>([]);
  const [historyFilters, setHistoryFilters] = useState({ from: "", to: "", topic: "" });
  const [topicOptions, setTopicOptions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const historyQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (historyFilters.from) params.set("from", historyFilters.from);
    if (historyFilters.to) params.set("to", historyFilters.to);
    if (historyFilters.topic) params.set("topic", historyFilters.topic);
    const query = params.toString();
    return query ? `?${query}` : "";
  }, [historyFilters]);
  const loadHistory = () => api<{ attempts: MockAttempt[] }>(`/mock-attempts${historyQuery}`).then((data) => setHistory(data.attempts));
  useEffect(() => { loadHistory().catch((err) => setError(err instanceof Error ? err.message : "Could not load mock history")); }, [historyQuery]);
  useEffect(() => {
    api<{ imports: ImportRow[] }>("/imports")
      .then((data) => setTopicOptions(Array.from(new Set(data.imports.map((item) => item.label))).sort((a, b) => a.localeCompare(b))))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!attempt || attempt.submittedAt) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [attempt?.id, attempt?.submittedAt]);
  const timeLabel = useMemo(() => attempt ? `${attempt.durationMinutes} min` : "", [attempt]);
  const remainingSeconds = useMemo(() => {
    if (!attempt || attempt.submittedAt) return null;
    const startedAt = new Date(attempt.startedAt).getTime();
    const endsAt = startedAt + attempt.durationMinutes * 60_000;
    return Math.max(0, Math.ceil((endsAt - now) / 1000));
  }, [attempt, now]);
  const remainingLabel = useMemo(() => {
    if (remainingSeconds === null) return "";
    const hours = Math.floor(remainingSeconds / 3600);
    const minutesLeft = Math.floor((remainingSeconds % 3600) / 60);
    const secondsLeft = remainingSeconds % 60;
    const paddedMinutes = String(minutesLeft).padStart(2, "0");
    const paddedSeconds = String(secondsLeft).padStart(2, "0");
    return hours > 0 ? `${hours}:${paddedMinutes}:${paddedSeconds}` : `${paddedMinutes}:${paddedSeconds}`;
  }, [remainingSeconds]);

  async function start() {
    setError("");
    try {
      const data = await api<{ attempt: MockAttempt }>("/mock-attempts", { method: "POST", body: JSON.stringify({ questionCount: count, durationMinutes: minutes }) });
      setAttempt(data.attempt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start mock");
    }
  }

  async function choose(questionId: string, answer: Answer) {
    if (!attempt) return;
    setError("");
    setAttempt((current) => current && current.id === attempt.id
      ? {
        ...current,
        questions: current.questions.map((item) =>
          item.questionId === questionId ? { ...item, selectedAnswer: answer } : item
        )
      }
      : current);
    try {
      await api(`/mock-attempts/${attempt.id}/answers/${questionId}`, { method: "POST", body: JSON.stringify({ answer }) });
    } catch {
      setError("Could not save answer. Your choice is shown, but submit will use the last saved answer.");
    }
  }

  async function submit() {
    if (!attempt) return;
    const data = await api<{ attempt: MockAttempt }>(`/mock-attempts/${attempt.id}/submit`, { method: "POST" });
    setAttempt(data.attempt);
    loadHistory();
  }

  async function extend() {
    if (!attempt) return;
    const data = await api<{ attempt: MockAttempt }>(`/mock-attempts/${attempt.id}/extend`, { method: "POST" });
    setAttempt({ ...attempt, ...data.attempt });
  }

  function downloadSummary() {
    if (!attempt) return;
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 520;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f6f8f7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(40, 40, 820, 440);
    ctx.strokeStyle = "#cfe5dc";
    ctx.strokeRect(40, 40, 820, 440);
    ctx.fillStyle = "#00594f";
    ctx.font = "700 42px Inter, Arial, sans-serif";
    ctx.fillText("PrepVault Mock Summary", 80, 115);
    ctx.font = "700 28px Inter, Arial, sans-serif";
    ctx.fillText(`Score: ${attempt.correctCount}/${attempt.requestedQuestionCount} (${attempt.scorePercent.toFixed(1)}%)`, 80, 185);
    ctx.font = "20px Inter, Arial, sans-serif";
    ctx.fillStyle = "#12322f";
    const lines = [
      `Started: ${new Date(attempt.startedAt).toLocaleString()}`,
      `Submitted: ${attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "Not submitted"}`,
      `Attempted: ${attempt.attemptedCount}`,
      `Incorrect: ${attempt.incorrectCount}`,
      `Duration: ${attempt.durationMinutes} minutes`
    ];
    lines.forEach((line, index) => ctx.fillText(line, 80, 250 + index * 38));
    const link = document.createElement("a");
    link.download = `prepvault-mock-summary-${attempt.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const submitted = Boolean(attempt?.submittedAt);

  return (
    <section className={attempt && !submitted ? "mock-full" : "split"}>
      <div className="panel mock-panel">
        <h2><Clock size={18} /> Mock Test</h2>
        {!attempt && <>
          <div className="mock-setup">
            <label>Questions<input type="number" min={10} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>
            <label>Minutes<input type="number" min={5} max={120} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
            <button onClick={start}>Start</button>
          </div>
          {error && <p className="error">{error}</p>}
        </>}
        {attempt && <>
          <div className="mock-status">
            <p className="meta">{timeLabel} | {submitted ? "Submitted" : "In progress"}</p>
            {!submitted && (
              <div className={remainingSeconds === 0 ? "mock-timer expired" : "mock-timer"} aria-live="polite">
                <span>Time remaining</span>
                <b>{remainingLabel}</b>
              </div>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          {submitted && (
            <div className="score-summary">
              <b>Score: {attempt.correctCount}/{attempt.requestedQuestionCount} ({attempt.scorePercent.toFixed(1)}%)</b>
              <span>{attempt.attemptedCount} attempted | {attempt.incorrectCount} incorrect</span>
              <div className="score-actions">
                <button type="button" className="ghost" onClick={downloadSummary}><ImageDown size={16} /> Download Summary PNG</button>
                <button type="button" onClick={() => setAttempt(null)}>Back to Mock Home</button>
              </div>
            </div>
          )}
          <div className="mock-question-list">
            {attempt.questions.map((item) => (
              <div className="mock-question" key={item.questionId}>
                <p>{item.displayOrder}. {item.question.questionText}</p>
                <div className="mock-answers">
                  {(["A", "B", "C", "D"] as const).map((key) => <button className={item.selectedAnswer === key ? "selected" : "ghost"} key={key} disabled={submitted} onClick={() => choose(item.questionId, key)}><b>{key}.</b> {optionValue(item.question, key)}</button>)}
                </div>
                {submitted && <p className="meta">Correct: {item.question.correctAnswer} | {item.question.explanation}</p>}
              </div>
            ))}
          </div>
          {!submitted && <div className="mock-actions"><button className="ghost" disabled={attempt.extensionUsed} onClick={extend}>+5 min</button><button onClick={submit}><Check size={16} /> Submit</button></div>}
        </>}
      </div>
      {(!attempt || submitted) && (
        <div className="panel data-panel mock-history-panel">
          <h2><History size={18} /> History</h2>
          <div className="history-filters">
            <label>
              From
              <input
                type="date"
                value={historyFilters.from}
                onChange={(e) => setHistoryFilters((current) => ({ ...current, from: e.target.value }))}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={historyFilters.to}
                onChange={(e) => setHistoryFilters((current) => ({ ...current, to: e.target.value }))}
              />
            </label>
            <label>
              Topic
              <select
                value={historyFilters.topic}
                onChange={(e) => setHistoryFilters((current) => ({ ...current, topic: e.target.value }))}
              >
                <option value="">All topics</option>
                {topicOptions.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
              </select>
            </label>
          </div>
          <div className="list">
            {history.map((item) => (
              <button
                className="list-item history-item"
                key={item.id}
                onClick={async () => setAttempt((await api<{ attempt: MockAttempt }>(`/mock-attempts/${item.id}`)).attempt)}
              >
                <span>{new Date(item.startedAt).toLocaleString()} | {item.correctCount}/{item.requestedQuestionCount}</span>
                <small>{item.topics?.length ? item.topics.join(" | ") : "No topics recorded"}</small>
              </button>
            ))}
            {history.length === 0 && <p className="muted">No mock attempts yet.</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState("imports");
  const refresh = () => api<Session>("/auth/me").then(setSession).catch(() => setSession(null));
  useEffect(() => { refresh(); }, []);
  const isAdminActor = session?.user.role === "ADMIN";
  const inStudentContext = session?.effectiveUser.role === "STUDENT";
  const studentTabs = ["configuration", "imports", "browse", "practice", "mock"];
  const activeTab = !inStudentContext && studentTabs.includes(tab)
    ? (isAdminActor ? "admin" : "profile")
    : tab === "admin" && !isAdminActor
      ? "profile"
      : tab;
  const pageTitles: Record<string, string> = {
    admin: "Admin",
    browse: "Browse",
    configuration: "Configuration",
    imports: "Imports",
    mock: "Mock",
    practice: "Practice",
    profile: "Profile"
  };
  useEffect(() => {
    document.title = `PrepVault - ${pageTitles[activeTab] ?? "Home"}`;
  }, [activeTab]);
  if (!session) return <Login onLogin={refresh} />;
  const navButtonClass = (name: string) => activeTab === name ? "nav-button active" : "nav-button";
  return (
    <main className="auth-shell">
      <header>
        <div className="header-brand">
          <img src={prepVaultLogo} alt="PrepVault" />
        </div>
        <div className="header-right">
          <nav aria-label="Primary navigation">
            {inStudentContext && (
              <div className="nav-group">
                <button className={navButtonClass("browse")} onClick={() => setTab("browse")}>Browse</button>
                <button className={navButtonClass("practice")} onClick={() => setTab("practice")}>Practice</button>
                <button className={navButtonClass("mock")} onClick={() => setTab("mock")}>Mock</button>
              </div>
            )}
            {(isAdminActor || inStudentContext) && (
              <div className="nav-group admin-nav-group">
                {isAdminActor && <button className={navButtonClass("admin")} onClick={() => setTab("admin")}><Users size={15} /> Admin</button>}
                {inStudentContext && <button className={navButtonClass("configuration")} onClick={() => setTab("configuration")}>Configuration</button>}
                {inStudentContext && <button className={navButtonClass("imports")} onClick={() => setTab("imports")}>Imports</button>}
              </div>
            )}
            <div className="nav-group account-nav-group">
              <button className={navButtonClass("profile")} onClick={() => setTab("profile")}><UserCircle size={15} /> Profile</button>
              <button className="logout-button" title="Logout" aria-label="Logout" onClick={async () => { await api("/auth/logout", { method: "POST" }); setSession(null); }}><LogOut size={16} /></button>
            </div>
          </nav>
          {session.emulating && (
            <div className="emulation-badge">
              <span>Viewing as {session.effectiveUser.name}</span>
              <button className="stop-emulation" onClick={async () => { await api("/admin/emulation/stop", { method: "POST" }); refresh(); }}>Stop emulation</button>
            </div>
          )}
        </div>
      </header>
      {activeTab === "admin" && isAdminActor && <Admin refresh={refresh} />}
      {activeTab === "profile" && <Profile session={session} refresh={refresh} onLoggedOut={() => setSession(null)} />}
      {activeTab === "configuration" && inStudentContext && <Configuration />}
      {activeTab === "imports" && inStudentContext && <Imports />}
      {activeTab === "browse" && inStudentContext && <Browse />}
      {activeTab === "practice" && inStudentContext && <Practice />}
      {activeTab === "mock" && inStudentContext && <MockTests />}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
