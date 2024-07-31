import './App.css';
import '@neo4j-ndl/base/lib/neo4j-ds-styles.css';
import ThemeWrapper from './context/ThemeWrapper';
import QuickStarter from './components/QuickStarter';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { APP_SOURCES } from './utils/Constants';
import ErrorBoundary from './components/UI/ErrroBoundary';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const App: React.FC = () => {
  const theme = createTheme({
    palette: {
      primary: {
        main: '#ff8552',
      },
      secondary: {
        main: '#fff8f5',
      },
    },
    components: {
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: '#fff8f5',
          },
        },
      },
      
    },
  });
  return (
    <>
      {APP_SOURCES != undefined && APP_SOURCES.includes('gcs') ? (
        <ErrorBoundary>
          <GoogleOAuthProvider clientId={process.env.GOOGLE_CLIENT_ID as string}>
            <ThemeWrapper>
              <QuickStarter />
            </ThemeWrapper>
          </GoogleOAuthProvider>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary>
          <ThemeProvider theme={theme}>
            <ThemeWrapper>
              <QuickStarter />
            </ThemeWrapper>
          </ThemeProvider>
        </ErrorBoundary>
      )}
    </>
  );
};

export default App;
