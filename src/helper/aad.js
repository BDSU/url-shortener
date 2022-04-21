const debug = require("debug")("url-shortener:helper:aad");
const axios = require("axios");
const ClientOAuth2 = require("client-oauth2");

module.exports = {
	/**
	 * create an OAuth2 Client
	 * @param {*} clientId 
	 * @param {*} secret 
	 * @param {*} tenantId 
	 * @param {*} redirectUri 
	 * @returns 
	 */
	getOAuthClient: function(clientId, secret, tenantId, redirectUri) {
		debug("create oauth2 client for " + clientId);
		return new ClientOAuth2({
			clientId: clientId,
			clientSecret: secret,
			scopes: ["user.read"],
			authorizationUri: "https://login.microsoftonline.com/" + tenantId + "/oauth2/v2.0/authorize",
			accessTokenUri: "https://login.microsoftonline.com/" + tenantId + "/oauth2/v2.0/token",
			redirectUri: redirectUri
		});
	},
	/**
	 * request application roles from graph api
	 * @param {*} objectId 
	 * @param {*} token 
	 * @returns 
	 */
	getApplicationRoles: async function(objectId, token) {
		const url = "https://graph.microsoft.com/v1.0/serviceprincipals/" + objectId;
		const headers = {
			headers: {
				authorization: "bearer " + token
			}
		};

		debug("get app roles from " + url);
		return axios.get(url, headers).then(res => {
			return res.data.appRoles.map(role => {
				return {
					"id": role.id,
					"name": role.displayName
				};
			});
		});

	},
	/**
	 * request users with application role from graph api
	 * @param {*} objectId 
	 * @param {*} token 
	 * @returns 
	 */
	getAssignedUsers: function(objectId, token) {
		const url = "https://graph.microsoft.com/v1.0/serviceprincipals/" + objectId + "/appRoleAssignedTo";
		const headers = {
			headers: {
				authorization: "bearer " + token
			}
		};

		debug("get app roles from " + url);
		return axios.get(url, headers).then(res => {
			return res.data.value.map(user => {
				return {
					"userId": user.principalId,
					"appRoleId": user.appRoleId
				};
			});
		});
	}
};