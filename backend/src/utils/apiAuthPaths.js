export function isBranchKioskApiPath(path) {
  return path === "/branch" || path.startsWith("/branch/");
}
