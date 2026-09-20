/** Read once at app start. Never derived from user input. */
export const APP_ENV = import.meta.env.VITE_APP_ENV === 'lab' ? 'lab' : 'study';
