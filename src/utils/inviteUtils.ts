import Cookies from 'js-cookie';

const INVITE_COOKIE_KEY = 'invite_code';
const INVITE_COOKIE_EXPIRES = 30; // 30 days

export const setInviteCookie = (inviteCode: string) => {
  Cookies.set(INVITE_COOKIE_KEY, inviteCode, { 
    expires: INVITE_COOKIE_EXPIRES,
    secure: true,
    sameSite: 'strict'
  });
};

export const getInviteCookie = (): string | null => {
  return Cookies.get(INVITE_COOKIE_KEY) || null;
};

export const clearInviteCookie = () => {
  Cookies.remove(INVITE_COOKIE_KEY);
};

export const hasValidInviteCode = (code: string): boolean => {
  // Basic validation - should be 8 characters, alphanumeric
  return /^[A-Z0-9]{8}$/.test(code);
};