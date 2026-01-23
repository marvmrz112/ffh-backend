import React, { useEffect } from "react";
import { Redirect, Route } from "react-router-dom";
import { IonApp, IonRouterOutlet, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";

import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

import "./theme/variables.css";

import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";

import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Home from "./pages/Home";

// News
import NewsList from "./pages/NewsList";
import NewsCreate from "./pages/NewsCreate";
import NewsDetail from "./pages/NewsDetail";

// Program
import ProgramList from "./pages/ProgramList";
import ProgramCreate from "./pages/ProgramCreate";
import ProgramDetail from "./pages/ProgramDetail";

// Food
import FoodList from "./pages/FoodList";
import FoodCreate from "./pages/FoodCreate";
import FoodDetail from "./pages/FoodDetail";

// Countdown / Sponsors
import Countdown from "./pages/Countdown";
import SponsorsList from "./pages/SponsorsList";
import SponsorsCreate from "./pages/SponsorsCreate";
import SponsorsDetail from "./pages/SponsorsDetail";

// Games
import GamesHome from "./pages/GamesHome";
import GamesEvents from "./pages/GamesEvents";
import GamesTeams from "./pages/GamesTeams";
import GamesDisciplines from "./pages/GamesDisciplines";
import GamesRuns from "./pages/GamesRuns";
import GamesResults from "./pages/GamesResults";

setupIonicReact();

// UUID Pattern (Supabase ids)
const UUID =
  ":id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})";

const App: React.FC = () => {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[ffh-backend] App mounted");
  }, []);

  return (
    <IonApp>
      <AuthProvider>
        <IonReactRouter>
          {/* Important for IonMenu contentId="main" (used by AppMenu) */}
          <IonRouterOutlet id="main">
            {/* PUBLIC */}
            <Route exact path="/login" component={Login} />
            <Route exact path="/auth/callback" component={AuthCallback} />

            {/* HOME */}
            <Route
              exact
              path="/"
              render={() => (
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              )}
            />

            {/* NEWS */}
            <Route
              exact
              path="/news"
              render={() => (
                <ProtectedRoute>
                  <NewsList />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path="/news/create"
              render={() => (
                <ProtectedRoute>
                  <NewsCreate />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path={`/news/${UUID}`}
              render={() => (
                <ProtectedRoute>
                  <NewsDetail />
                </ProtectedRoute>
              )}
            />

            {/* PROGRAM */}
            <Route
              exact
              path="/program"
              render={() => (
                <ProtectedRoute>
                  <ProgramList />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path="/program/create"
              render={() => (
                <ProtectedRoute>
                  <ProgramCreate />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path={`/program/${UUID}`}
              render={() => (
                <ProtectedRoute>
                  <ProgramDetail />
                </ProtectedRoute>
              )}
            />

            {/* FOOD */}
            <Route
              exact
              path="/food"
              render={() => (
                <ProtectedRoute>
                  <FoodList />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path="/food/create"
              render={() => (
                <ProtectedRoute>
                  <FoodCreate />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path={`/food/${UUID}`}
              render={() => (
                <ProtectedRoute>
                  <FoodDetail />
                </ProtectedRoute>
              )}
            />

            {/* COUNTDOWN */}
            <Route
              exact
              path="/countdown"
              render={() => (
                <ProtectedRoute>
                  <Countdown />
                </ProtectedRoute>
              )}
            />

            {/* SPONSORS */}
            <Route
              exact
              path="/sponsors"
              render={() => (
                <ProtectedRoute>
                  <SponsorsList />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path="/sponsors/create"
              render={() => (
                <ProtectedRoute>
                  <SponsorsCreate />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path={`/sponsors/${UUID}`}
              render={() => (
                <ProtectedRoute>
                  <SponsorsDetail />
                </ProtectedRoute>
              )}
            />

            {/* GAMES */}
            <Route
              exact
              path="/games"
              render={() => (
                <ProtectedRoute>
                  <GamesHome />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path="/games/events"
              render={() => (
                <ProtectedRoute>
                  <GamesEvents />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path="/games/teams"
              render={() => (
                <ProtectedRoute>
                  <GamesTeams />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path="/games/disciplines"
              render={() => (
                <ProtectedRoute>
                  <GamesDisciplines />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path="/games/runs"
              render={() => (
                <ProtectedRoute>
                  <GamesRuns />
                </ProtectedRoute>
              )}
            />
            <Route
              exact
              path="/games/results"
              render={() => (
                <ProtectedRoute>
                  <GamesResults />
                </ProtectedRoute>
              )}
            />

            {/* FALLBACK */}
            <Route render={() => <Redirect to="/" />} />
          </IonRouterOutlet>
        </IonReactRouter>
      </AuthProvider>
    </IonApp>
  );
};

export default App;
