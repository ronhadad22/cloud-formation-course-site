const express = require('express');
const session = require('express-session');
const passport = require('passport');
const OpenIDConnectStrategy = require('passport-openidconnect');

const app = express();
const PORT = 3000;

app.use(session({
  secret: 'keycloak-lab-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 3600000 }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:30080';
const REALM = process.env.KEYCLOAK_REALM || 'demo-realm';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'demo-app';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';
const APP_URL = process.env.APP_URL || 'http://localhost:30300';

passport.use('oidc', new OpenIDConnectStrategy({
  issuer: KEYCLOAK_URL + '/realms/' + REALM,
  authorizationURL: KEYCLOAK_URL + '/realms/' + REALM + '/protocol/openid-connect/auth',
  tokenURL: KEYCLOAK_URL + '/realms/' + REALM + '/protocol/openid-connect/token',
  userInfoURL: KEYCLOAK_URL + '/realms/' + REALM + '/protocol/openid-connect/userinfo',
  clientID: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  callbackURL: APP_URL + '/auth/callback',
  scope: 'openid profile email roles'
}, function(issuer, profile, done) {
  return done(null, profile);
}));

function getUserDisplay(user) {
  return user ? (user.displayName || user.username || 'User') : '';
}

function getUserRoles(user) {
  var realmRoles = (user && user._json && user._json.realm_access && user._json.realm_access.roles) ? user._json.realm_access.roles : [];
  var clientRoles = (user && user._json && user._json.resource_access && user._json.resource_access[CLIENT_ID] && user._json.resource_access[CLIENT_ID].roles) ? user._json.resource_access[CLIENT_ID].roles : [];
  return { realm: realmRoles, client: clientRoles, all: realmRoles.concat(clientRoles) };
}

var CSS = '* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: Segoe UI, Arial, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; } .navbar { background: #1e293b; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; } .navbar h1 { color: #3b82f6; font-size: 1.5rem; } .btn { padding: 8px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; cursor: pointer; border: none; font-size: 0.9rem; } .btn-primary { background: #3b82f6; color: white; } .btn-danger { background: #ef4444; color: white; } .container { max-width: 1000px; margin: 40px auto; padding: 0 20px; } .card { background: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #334155; } .card h2 { color: #3b82f6; margin-bottom: 12px; } .card h3 { color: #f59e0b; margin-bottom: 8px; } table { width: 100%; border-collapse: collapse; margin-top: 12px; } th, td { padding: 10px 16px; text-align: left; border-bottom: 1px solid #334155; } th { color: #94a3b8; } .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; margin: 2px; } .badge-admin { background: #ef4444; color: white; } .badge-manager { background: #f59e0b; color: #1e293b; } .badge-employee { background: #3b82f6; color: white; } .badge-public { background: #6b7280; color: white; } .badge-role { background: #3b82f6; color: white; } .hero { text-align: center; padding: 60px 20px; } .hero h2 { font-size: 2rem; margin-bottom: 16px; } .hero p { color: #94a3b8; font-size: 1.1rem; margin-bottom: 24px; } .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; } .nav-links { display: flex; gap: 12px; align-items: center; } pre { background: #0f172a; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; color: #94a3b8; } .status { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; } .status-green { background: #22c55e; } .status-red { background: #ef4444; } .k8s-badge { background: #326ce5; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px; }';

app.get('/', function(req, res) {
  var user = req.user;
  var navContent = user
    ? '<span>Welcome, <strong>' + getUserDisplay(user) + '</strong></span> <a href="/dashboard" class="btn btn-primary">Dashboard</a> <a href="/logout" class="btn btn-danger">Logout</a>'
    : '<span class="badge badge-public">Not authenticated</span> <a href="/login" class="btn btn-primary">Sign In with Keycloak</a>';
  var heroBtn = !user ? '<a href="/login" class="btn btn-primary" style="font-size:1.1rem;padding:12px 32px;">Sign In with Keycloak &rarr;</a>' : '';
  res.send('<!DOCTYPE html><html><head><title>HR Portal - Keycloak on K8s</title><style>' + CSS + '</style></head><body>' +
    '<nav class="navbar"><h1>&#127970; HR Portal <span class="k8s-badge">K8s + Terraform</span></h1><div class="nav-links">' + navContent + '</div></nav>' +
    '<div class="container"><div class="hero"><h2>Welcome to the HR Portal</h2>' +
    '<p>This application runs on <strong>Minikube</strong>, protected by <strong>Keycloak</strong> (OIDC), all provisioned with <strong>Terraform</strong>.</p>' +
    '<p>Sign in to access employee dashboards, salary data, and admin panels.</p>' + heroBtn + '</div>' +
    '<div class="grid">' +
    '<div class="card"><h3>&#128203; /dashboard</h3><p>Employee dashboard &mdash; requires authentication</p><span class="badge badge-employee">Any authenticated user</span></div>' +
    '<div class="card"><h3>&#128176; /salary</h3><p>Salary information &mdash; requires manager or admin role</p><span class="badge badge-manager">manager / admin</span></div>' +
    '<div class="card"><h3>&#9881; /admin</h3><p>Admin panel &mdash; requires admin role only</p><span class="badge badge-admin">admin only</span></div>' +
    '</div></div></body></html>');
});

app.get('/login', passport.authenticate('oidc'));

app.get('/auth/callback',
  passport.authenticate('oidc', { failureRedirect: '/' }),
  function(req, res) { res.redirect('/dashboard'); }
);

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

function requireRole(role) {
  return function(req, res, next) {
    if (!req.isAuthenticated()) return res.redirect('/login');
    var r = getUserRoles(req.user);
    if (r.all.indexOf(role) !== -1 || r.all.indexOf('admin') !== -1) return next();
    res.status(403).send('<!DOCTYPE html><html><head><title>Access Denied</title><style>' + CSS + '</style></head><body>' +
      '<div style="display:flex;justify-content:center;align-items:center;min-height:100vh;">' +
      '<div class="card" style="text-align:center;border:2px solid #ef4444;max-width:500px;">' +
      '<h2 style="color:#ef4444;">&#128683; Access Denied</h2>' +
      '<p>You need the <strong>' + role + '</strong> role to access this page.</p>' +
      '<p>Your roles: ' + (r.all.join(', ') || 'none') + '</p>' +
      '<p><a href="/dashboard" style="color:#3b82f6;">&larr; Back to Dashboard</a> | <a href="/" style="color:#3b82f6;">Home</a></p>' +
      '</div></div></body></html>');
  };
}

app.get('/dashboard', ensureAuthenticated, function(req, res) {
  var user = req.user;
  var r = getUserRoles(user);
  var json = user._json || {};
  var realmBadges = r.realm.map(function(x) { return '<span class="badge badge-role">' + x + '</span>'; }).join(' ') || 'none';
  var clientBadges = r.client.map(function(x) { return '<span class="badge badge-role">' + x + '</span>'; }).join(' ') || 'none';
  res.send('<!DOCTYPE html><html><head><title>Dashboard - HR Portal</title><style>' + CSS + '</style></head><body>' +
    '<nav class="navbar"><h1>&#127970; HR Portal</h1><div class="nav-links"><a href="/" class="btn btn-primary">Home</a><a href="/salary" class="btn btn-primary">Salary</a><a href="/admin" class="btn btn-primary">Admin</a><a href="/logout" class="btn btn-danger">Logout</a></div></nav>' +
    '<div class="container">' +
    '<div class="card"><h2>&#128100; Your Profile</h2><table>' +
    '<tr><th>Field</th><th>Value</th></tr>' +
    '<tr><td>Display Name</td><td>' + getUserDisplay(user) + '</td></tr>' +
    '<tr><td>Username</td><td>' + (json.preferred_username || 'N/A') + '</td></tr>' +
    '<tr><td>Email</td><td>' + (json.email || 'N/A') + '</td></tr>' +
    '<tr><td>Email Verified</td><td>' + (json.email_verified || false) + '</td></tr>' +
    '<tr><td>Issuer</td><td>' + (json.iss || 'N/A') + '</td></tr>' +
    '</table></div>' +
    '<div class="card"><h2>&#128273; Your Roles</h2>' +
    '<p><strong>Realm roles:</strong> ' + realmBadges + '</p>' +
    '<p style="margin-top:8px"><strong>Client roles:</strong> ' + clientBadges + '</p></div>' +
    '<div class="card"><h2>&#128269; Raw ID Token Claims</h2><pre>' + JSON.stringify(json, null, 2) + '</pre></div>' +
    '</div></body></html>');
});

app.get('/salary', requireRole('manager'), function(req, res) {
  res.send('<!DOCTYPE html><html><head><title>Salary - HR Portal</title><style>' + CSS + ' .navbar { border-bottom-color: #f59e0b; } .card h2 { color: #f59e0b; }</style></head><body>' +
    '<nav class="navbar"><h1>&#128176; Salary Information</h1><div class="nav-links"><a href="/dashboard" class="btn btn-primary">Dashboard</a><a href="/logout" class="btn btn-danger">Logout</a></div></nav>' +
    '<div class="container"><div class="card"><h2>Employee Salary Data</h2>' +
    '<p style="color:#94a3b8;margin-bottom:12px;">This page is only visible to users with the <strong>manager</strong> or <strong>admin</strong> role.</p>' +
    '<table><tr><th>Employee</th><th>Department</th><th>Salary</th><th>Status</th></tr>' +
    '<tr><td>Alice Johnson</td><td>Engineering</td><td>$125,000</td><td style="color:#22c55e">Active</td></tr>' +
    '<tr><td>Bob Smith</td><td>Marketing</td><td>$95,000</td><td style="color:#22c55e">Active</td></tr>' +
    '<tr><td>Carol Williams</td><td>Engineering</td><td>$135,000</td><td style="color:#22c55e">Active</td></tr>' +
    '<tr><td>David Brown</td><td>HR</td><td>$88,000</td><td style="color:#f59e0b">On Leave</td></tr>' +
    '</table></div></div></body></html>');
});

app.get('/admin', requireRole('admin'), function(req, res) {
  var username = (req.user && req.user._json) ? req.user._json.preferred_username : 'unknown';
  res.send('<!DOCTYPE html><html><head><title>Admin - HR Portal</title><style>' + CSS + ' .navbar { border-bottom-color: #ef4444; } .card h2 { color: #ef4444; }</style></head><body>' +
    '<nav class="navbar"><h1>&#9881; Admin Panel</h1><div class="nav-links"><a href="/dashboard" class="btn btn-primary">Dashboard</a><a href="/logout" class="btn btn-danger">Logout</a></div></nav>' +
    '<div class="container">' +
    '<div class="card"><h2>System Administration</h2>' +
    '<p style="color:#94a3b8;margin-bottom:12px;">This page is only visible to users with the <strong>admin</strong> role.</p>' +
    '<table><tr><th>Service</th><th>Status</th><th>Uptime</th></tr>' +
    '<tr><td>Keycloak IdP</td><td><span class="status status-green"></span>Running</td><td>99.9%</td></tr>' +
    '<tr><td>HR Database</td><td><span class="status status-green"></span>Running</td><td>99.7%</td></tr>' +
    '<tr><td>Email Service</td><td><span class="status status-green"></span>Running</td><td>98.5%</td></tr>' +
    '<tr><td>Backup System</td><td><span class="status status-red"></span>Maintenance</td><td>95.2%</td></tr>' +
    '</table></div>' +
    '<div class="card"><h2>Recent Audit Log</h2><table>' +
    '<tr><th>Time</th><th>User</th><th>Action</th></tr>' +
    '<tr><td>2 min ago</td><td>' + username + '</td><td>Accessed admin panel</td></tr>' +
    '<tr><td>15 min ago</td><td>system</td><td>Backup completed</td></tr>' +
    '<tr><td>1 hour ago</td><td>admin</td><td>User role updated</td></tr>' +
    '<tr><td>3 hours ago</td><td>system</td><td>Certificate renewed</td></tr>' +
    '</table></div></div></body></html>');
});

app.get('/api/tokeninfo', ensureAuthenticated, function(req, res) {
  var r = getUserRoles(req.user);
  res.json({ user: req.user._json, realm_roles: r.realm, client_roles: r.client, session_id: req.sessionID });
});

app.get('/logout', function(req, res) {
  req.logout(function() {
    req.session.destroy(function() {
      var logoutUrl = KEYCLOAK_URL + '/realms/' + REALM + '/protocol/openid-connect/logout?post_logout_redirect_uri=' + encodeURIComponent(APP_URL) + '&client_id=' + CLIENT_ID;
      res.redirect(logoutUrl);
    });
  });
});

app.listen(PORT, '0.0.0.0', function() {
  console.log('HR Portal running on port ' + PORT);
  console.log('Keycloak URL: ' + KEYCLOAK_URL);
  console.log('Realm: ' + REALM);
  console.log('Client ID: ' + CLIENT_ID);
});
