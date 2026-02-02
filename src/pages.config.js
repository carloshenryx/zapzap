import { lazy } from 'react';
import __Layout from './Layout.jsx';

function lazyWithRetry(importer) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (err) {
      const message = String(err?.message || '');
      const shouldRetry =
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('Importing a module script failed') ||
        message.includes('error loading dynamically imported module');

      if (shouldRetry) {
        const key = 'lazy_import_retry_v1';
        try {
          const alreadyRetried = sessionStorage.getItem(key) === '1';
          if (!alreadyRetried) {
            sessionStorage.setItem(key, '1');
            window.location.reload();
          }
        } catch (_) {
          window.location.reload();
        }
      }

      throw err;
    }
  });
}

// Lazy load all pages
const Admin = lazyWithRetry(() => import('./pages/Admin'));
const AdminPanel = lazyWithRetry(() => import('./pages/AdminPanel'));
const Checkout = lazyWithRetry(() => import('./pages/Checkout'));
const Customers = lazyWithRetry(() => import('./pages/Customers'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const FreeTrialSignup = lazyWithRetry(() => import('./pages/FreeTrialSignup'));
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const LoginNew = lazyWithRetry(() => import('./pages/LoginNew'));
const Signup = lazyWithRetry(() => import('./pages/Signup'));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const MasterDashboard = lazyWithRetry(() => import('./pages/MasterDashboard'));
const PreLogin = lazyWithRetry(() => import('./pages/PreLogin'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Reports = lazyWithRetry(() => import('./pages/Reports'));
const SendSurvey = lazyWithRetry(() => import('./pages/SendSurvey'));
const Survey = lazyWithRetry(() => import('./pages/Survey'));
const TenantManagement = lazyWithRetry(() => import('./pages/TenantManagement'));
const TotemDisplay = lazyWithRetry(() => import('./pages/TotemDisplay'));
const UpgradePlan = lazyWithRetry(() => import('./pages/UpgradePlan'));
const WhatsAppManager = lazyWithRetry(() => import('./pages/WhatsAppManager'));
const CRM = lazyWithRetry(() => import('./pages/CRM'));
const CustomerDetail = lazyWithRetry(() => import('./pages/CustomerDetail'));
const CRMTasks = lazyWithRetry(() => import('./pages/CRMTasks'));
const CRMSegments = lazyWithRetry(() => import('./pages/CRMSegments'));
const CRMAutomations = lazyWithRetry(() => import('./pages/CRMAutomations'));
const Onboarding = lazyWithRetry(() => import('./pages/Onboarding'));


export const PAGES = {
    "Admin": Admin,
    "AdminPanel": AdminPanel,
    "Checkout": Checkout,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "FreeTrialSignup": FreeTrialSignup,
    "LandingPage": LandingPage,
    "Login": Login,
    "LoginNew": LoginNew,
    "Signup": Signup,
    "ForgotPassword": ForgotPassword,
    "ResetPassword": ResetPassword,
    "MasterDashboard": MasterDashboard,
    "PreLogin": PreLogin,
    "Profile": Profile,
    "Reports": Reports,
    "SendSurvey": SendSurvey,
    "Survey": Survey,
    "TenantManagement": TenantManagement,
    "TotemDisplay": TotemDisplay,
    "UpgradePlan": UpgradePlan,
    "WhatsAppManager": WhatsAppManager,
    "CRM": CRM,
    "CustomerDetail": CustomerDetail,
    "CRMTasks": CRMTasks,
    "CRMSegments": CRMSegments,
    "CRMAutomations": CRMAutomations,
    "Onboarding": Onboarding,
}

export const pagesConfig = {
    mainPage: "Login",
    Pages: PAGES,
    Layout: __Layout,
};
