import * as cheerio from "cheerio";

export const visitUrl = async ({
  toVisiteUrl = "https://schoolapp.ensam-umi.ac.ma/plan-etudes-view/filieres",
  returnContent = false,
  sessionId,
}: {
  toVisiteUrl?: string;
  returnContent?: boolean;
  sessionId?: string | null;
}) => {
  if (!sessionId) {
    console.warn("visitUrl: no sessionId");
    return false;
  }

  let res: Response;
  try {
    res = await fetch(toVisiteUrl, {
      redirect: "follow",
      headers: {
        Cookie: `JSESSIONID=${sessionId}`,
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } catch (err) {
    console.error("visitUrl fetch error:", err);
    return false;
  }

  const resContent = await res.text();
  const $ = cheerio.load(resContent);

  // Detect redirect to any login page (covers /login and /schoolapp/login)
  const onLoginPage =
    $('form[action*="/login"]').length > 0 ||
    $('input[name="password"]').length > 0;

  // Detect authenticated content (logout link anywhere on page)
  const hasLogout =
    $('[href*="logout"]').length > 0 ||
    $('[action*="logout"]').length > 0;

  const isAuthenticated = !onLoginPage && hasLogout;

  if (!isAuthenticated) {
    console.warn(
      `visitUrl: not authenticated for ${toVisiteUrl}`,
      `| status=${res.status} | finalUrl=${res.url}`,
      `| onLoginPage=${onLoginPage} | hasLogout=${hasLogout}`,
    );
    return false;
  }

  return returnContent ? { isAuthenticated, data: resContent } : true;
};
