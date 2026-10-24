// La versión web del almacén: el localStorage del navegador, con los mismos nombres que expo-sqlite
// (su versión web pide SharedArrayBuffer, que Safari no da por http).

const Storage = {
  getItemSync: (clave: string): string | null => localStorage.getItem(clave),
  setItemSync: (clave: string, valor: string): void => localStorage.setItem(clave, valor),
  removeItemSync: (clave: string): void => localStorage.removeItem(clave),
};

export default Storage;
