<#import "layout/app.ftl" as layout>
<@layout.app>
<div class="jumbotron" style="margin-top: 50px;">
		<h2>Documentum REST Services</h2>
    <p class="lead">Open Text Documentum Platform REST Services provides you with a powerful yet simple web service
        interface to
            interact with Documentum.</p>
    <a class="btn btn-primary btn-outline" href="${baseUri}/services">
        SERVICES <i class="glyphicon glyphicon-menu-right"></i>
    </a>
    <a class="btn btn-success btn-outline" href="${baseUri}/static/openapi/index.html">
        OPENAPI REFERENCE <i class="glyphicon glyphicon-menu-right"></i>
    </a>
	</div>
</@layout.app>
