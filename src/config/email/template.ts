import ejs from "ejs";
import path from "path";

interface TemplateParams {
  code: string | number;
  username: string;
  from: string;
}

const renderHtml = async (
  code: string | number,
  username: string,
  from: string
): Promise<string> => {
  const templatePath = path.join(__dirname, "views", "email-template.ejs");

  return await ejs.renderFile(templatePath, {
    username,
    code,
    email: from,
  });
};

export default renderHtml;
