import app from "./app";

const server = app.listen(app.get("port"), () => {
console.log(`
 
██╗     ██╗ ██████╗ ███╗   ██╗███████╗ ██████╗ ███████╗████████╗
██║     ██║██╔═══██╗████╗  ██║██╔════╝██╔═══██╗██╔════╝╚══██╔══╝
██║     ██║██║   ██║██╔██╗ ██║███████╗██║   ██║█████╗     ██║   
██║     ██║██║   ██║██║╚██╗██║╚════██║██║   ██║██╔══╝     ██║   
███████╗██║╚██████╔╝██║ ╚████║███████║╚██████╔╝██║        ██║   
╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝        ╚═╝   
                                                                

Powered by: LIONSOFT
`);
  console.log(
    " Aplicación ejecutándose en http://localhost:%d in %s mode",
    app.get("port"),
    app.get("env")
  );
 
});

export default server;
