
export class Logger {
  public info(message: string, ...args: any[]) {
    console.info(`[INFO] ${message}`, ...args);
  }
  
  public warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${message}`, ...args);
  }

  public error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${message}`, ...args);
  }
  
  public debug(message: string, ...args: any[]) {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
}