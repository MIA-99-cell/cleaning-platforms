const config = require('../config');

const isSupabaseConfigured = () =>
  !!(config.supabase.url && config.supabase.anonKey && config.supabase.serviceRoleKey);

const buildUrl = (path) => `${config.supabase.url.replace(/\/$/, '')}${path}`;

const authHeaders = (useServiceRole = false) => ({
  'Content-Type': 'application/json',
  apikey: useServiceRole ? config.supabase.serviceRoleKey : config.supabase.anonKey,
  ...(useServiceRole && { Authorization: `Bearer ${config.supabase.serviceRoleKey}` }),
});

const parseAuthError = (data) =>
  data?.msg || data?.error_description || data?.message || data?.error || 'request failed';

const registerSupabaseUser = async ({ email, password, metadata = {}, redirectTo }) => {
  if (!isSupabaseConfigured()) return { success: false, skipped: true, reason: 'not_configured' };
  try {
    const res = await fetch(buildUrl('/auth/v1/signup'), {
      method: 'POST',
      headers: authHeaders(false),
      body: JSON.stringify({
        email,
        password,
        data: metadata,
        options: { emailRedirectTo: redirectTo },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { success: true, userId: data?.user?.id, sent: true };

    const message = parseAuthError(data);
    if (res.status === 422 || /already registered|already exists/i.test(message)) {
      return { success: true, existed: true };
    }
    return { success: false, error: message };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const ensureSupabaseUser = async ({ email, password, metadata = {} }) => {
  if (!isSupabaseConfigured()) return { success: false, skipped: true, reason: 'not_configured' };
  try {
    const listRes = await fetch(buildUrl('/auth/v1/admin/users?page=1&per_page=1000'), {
      headers: authHeaders(true),
    });
    const listData = await listRes.json();
    const users = listData?.users || [];
    const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return { success: true, existed: true, userId: user.id };

    const createRes = await fetch(buildUrl('/auth/v1/admin/users'), {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        email,
        password,
        email_confirm: false,
        user_metadata: metadata,
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) return { success: false, error: parseAuthError(createData) };
    return { success: true, userId: createData?.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const sendSupabaseVerificationEmail = async ({ email, redirectTo }) => {
  if (!isSupabaseConfigured()) return { success: false, skipped: true, reason: 'not_configured' };
  try {
    const res = await fetch(buildUrl('/auth/v1/resend'), {
      method: 'POST',
      headers: authHeaders(false),
      body: JSON.stringify({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirectTo },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: parseAuthError(data) };
    return { success: true, via: 'supabase' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const sendSupabaseResetPasswordEmail = async ({ email, redirectTo }) => {
  if (!isSupabaseConfigured()) return { success: false, skipped: true, reason: 'not_configured' };
  try {
    const res = await fetch(buildUrl('/auth/v1/recover'), {
      method: 'POST',
      headers: authHeaders(false),
      body: JSON.stringify({
        email,
        options: { redirectTo },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: parseAuthError(data) };
    return { success: true, via: 'supabase' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const updateSupabaseUserPassword = async ({ email, password }) => {
  if (!isSupabaseConfigured()) return { success: false, skipped: true, reason: 'not_configured' };
  try {
    const listRes = await fetch(buildUrl('/auth/v1/admin/users?page=1&per_page=1000'), {
      headers: authHeaders(true),
    });
    const listData = await listRes.json();
    const user = (listData?.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) return { success: false, error: 'user_not_found' };

    const res = await fetch(buildUrl(`/auth/v1/admin/users/${user.id}`), {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: parseAuthError(data) };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const sendSupabaseInviteEmail = async ({ email, redirectTo, metadata = {} }) => {
  if (!isSupabaseConfigured()) return { success: false, skipped: true, reason: 'not_configured' };
  try {
    const res = await fetch(buildUrl('/auth/v1/invite'), {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        email,
        data: metadata,
        redirect_to: redirectTo,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: parseAuthError(data) };
    return { success: true, via: 'supabase_invite' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const sendSupabaseMagicLinkEmail = async ({ email, redirectTo, createUser = true }) => {
  if (!isSupabaseConfigured()) return { success: false, skipped: true, reason: 'not_configured' };
  try {
    const res = await fetch(buildUrl('/auth/v1/otp'), {
      method: 'POST',
      headers: authHeaders(false),
      body: JSON.stringify({
        email,
        create_user: createUser,
        options: { emailRedirectTo: redirectTo },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: parseAuthError(data) };
    return { success: true, via: 'supabase_magic_link' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const verifySupabaseAccessToken = async (accessToken) => {
  if (!isSupabaseConfigured()) return { success: false, error: 'not_configured' };
  try {
    const res = await fetch(buildUrl('/auth/v1/user'), {
      headers: {
        apikey: config.supabase.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: parseAuthError(data) };
    return { success: true, user: data?.user || data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const provisionSupabaseAuthUser = async ({ email, password, metadata = {}, redirectTo }) => {
  const signup = await registerSupabaseUser({ email, password, metadata, redirectTo });
  if (signup.success && signup.sent) return signup;
  if (signup.success && signup.existed) {
    await ensureSupabaseUser({ email, password, metadata });
    return sendSupabaseVerificationEmail({ email, redirectTo });
  }
  return signup;
};

module.exports = {
  isSupabaseConfigured,
  ensureSupabaseUser,
  registerSupabaseUser,
  provisionSupabaseAuthUser,
  sendSupabaseVerificationEmail,
  sendSupabaseResetPasswordEmail,
  sendSupabaseInviteEmail,
  sendSupabaseMagicLinkEmail,
  updateSupabaseUserPassword,
  verifySupabaseAccessToken,
};
