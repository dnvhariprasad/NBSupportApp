<#macro app>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
		<title>Documentum REST Services</title>
        <script type="text/javascript" src="${baseUri}/static/javascript/jquery.min.js"></script>
        <script type="text/javascript" src="${baseUri}/static/bootstrap/js/bootstrap.min.js"></script>
        <link rel="icon" type="image/png" href="${baseUri}/static/images/icon.png">
        <link rel="stylesheet" href="${baseUri}/static/bootstrap/css/bootstrap.min.css" type="text/css"
              media="screen, projection"/>
        <style>
            .btn-outline {
                background-color: transparent;
                color: inherit;
                transition: all .3s;
                font-weight: 300;
            }
            .btn-primary.btn-outline {
                color: #428bca;
            }
            .btn-success.btn-outline {
                color: #5cb85c;
            }
            .btn-primary.btn-outline:hover,
            .btn-success.btn-outline:hover {
                color: #fff;
            }
        </style>
	</head>
	<body>
		<div class="container">
			<div id="header">
				<#include "header.ftl"/>
			</div>
			<div class="span12">
				<#nested/>
			</div>
			<div id="footer" class="span12">
				<#include "footer.ftl"/>
			</div>
		</div>
	</body>
</html>
</#macro>