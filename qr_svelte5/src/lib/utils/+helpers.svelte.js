import { PUBLIC_APP_SUBFOLDER } from "$env/static/public";

export const getSubfolder = () => {
  return PUBLIC_APP_SUBFOLDER ? '/' + PUBLIC_APP_SUBFOLDER : '';
}