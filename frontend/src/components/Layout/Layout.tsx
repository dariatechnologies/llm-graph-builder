import * as React from 'react';
import { styled, /* useTheme, */ Theme, CSSObject } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
// import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
// import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
// import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
// import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useState } from 'react';
import SideNav from './SideNav';
import DrawerDropzone from './DrawerDropzone';
import DrawerChatbot from './DrawerChatbot';
import Content from '../Content';
import SettingsModal from '../Popups/Settings/SettingModal';
import { clearChatAPI } from '../../services/QnaAPI';
import { useCredentials } from '../../context/UserCredentials';
import { UserCredentials, alertStateType } from '../../types';
import { useMessageContext } from '../../context/UserMessages';
import { AlertColor, AlertPropsColorOverrides } from '@mui/material';
import { OverridableStringUnion } from '@mui/types';
import { useFileContext } from '../../context/UsersFiles';
import SchemaFromTextDialog from '../Popups/Settings/SchemaFromText';
import CustomAlert from '../UI/Alert';

import logo from '../../assets/images/logo.png';

const drawerWidth = 240;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

// interface AppBarProps extends MuiAppBarProps {
//   open?: boolean;
// }

// const AppBar = styled(MuiAppBar, {
//   shouldForwardProp: (prop) => prop !== 'open',
// })<AppBarProps>(({ theme, open }) => ({
//   zIndex: theme.zIndex.drawer + 1,
//   transition: theme.transitions.create(['width', 'margin'], {
//     easing: theme.transitions.easing.sharp,
//     duration: theme.transitions.duration.leavingScreen,
//   }),
//   ...(open && {
//     marginLeft: drawerWidth,
//     width: `calc(100% - ${drawerWidth}px)`,
//     transition: theme.transitions.create(['width', 'margin'], {
//       easing: theme.transitions.easing.sharp,
//       duration: theme.transitions.duration.enteringScreen,
//     }),
//   }),
// }));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme),
    '& .MuiDrawer-paper': openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    '& .MuiDrawer-paper': closedMixin(theme),
  }),
}));

export default function Layout({
  isSettingPanelExpanded,
  closeSettingModal,
  openSettingsDialog,
}: {
  isSettingPanelExpanded: boolean;
  closeSettingModal: () => void;
  openSettingsDialog: () => void;
}) {
  // const theme = useTheme();
  const [open, setOpen] = React.useState(true);

  // const handleDrawerOpen = () => {
  //   setOpen(open);
  // };

  const handleDrawerClose = () => {
    setOpen(!open);
  };

  const [isLeftExpanded, setIsLeftExpanded] = useState<boolean>(true);
  const [isRightExpanded, setIsRightExpanded] = useState<boolean>(true);
  const [showChatBot, setShowChatBot] = useState<boolean>(false);
  const [showDrawerChatbot, setShowDrawerChatbot] = useState<boolean>(true);
  const [clearHistoryData, setClearHistoryData] = useState<boolean>(false);
  const [showEnhancementDialog, setshowEnhancementDialog] = useState<boolean>(false);
  const { userCredentials } = useCredentials();
  const toggleLeftDrawer = () => setIsLeftExpanded(!isLeftExpanded);
  const toggleRightDrawer = () => setIsRightExpanded(!isRightExpanded);
  const [alertDetails, setalertDetails] = useState<alertStateType>({
    showAlert: false,
    alertType: 'error',
    alertMessage: '',
  });

  const [selected, setSelected] = useState<string>('');

  const { messages } = useMessageContext();
  const { isSchema, setIsSchema, setShowTextFromSchemaDialog, showTextFromSchemaDialog } = useFileContext();

  const deleteOnClick = async () => {
    try {
      setClearHistoryData(true);
      const response = await clearChatAPI(
        userCredentials as UserCredentials,
        sessionStorage.getItem('session_id') ?? ''
      );
      if (response.data.status === 'Success') {
        setClearHistoryData(false);
      }
    } catch (error) {
      console.log(error);
      setClearHistoryData(false);
    }
  };

  const showAlert = (
    alertmsg: string,
    alerttype: OverridableStringUnion<AlertColor, AlertPropsColorOverrides> | undefined
  ) => {
    setalertDetails({
      showAlert: true,
      alertMessage: alertmsg,
      alertType: alerttype,
    });
  };
  const handleClose = () => {
    setalertDetails({
      showAlert: false,
      alertType: 'info',
      alertMessage: '',
    });
  };
  console.log(toggleLeftDrawer,"toggleLeftDrawer")
  return (
    <Box sx={{ display: 'flex' }}>
      {/* <CssBaseline /> */}
      {/* <AppBar position='fixed' color='secondary' open={open}>
        <Toolbar>
          <IconButton
            color='inherit'
            aria-label='open drawer'
            onClick={handleDrawerOpen}
            edge='start'
            sx={{
              marginRight: 5,
              ...(open && { display: 'none' }),
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant='h6' noWrap component='div'>
            LLM Bots
          </Typography>
        </Toolbar>
      </AppBar> */}
      <Drawer variant='permanent' open={open} className='!z-0'>
        <DrawerHeader>
          <div className='flex items-center w-full justify-between py-4'>
            {open && (
              <>
                <img src={logo} alt='logo' width={50} height={50} />
                <Typography variant='h6' noWrap component='div'>
                  LLM Bots
                </Typography>
              </>
            )}
            <IconButton onClick={handleDrawerClose}>{!open ? <ChevronRightIcon /> : <ChevronLeftIcon />}</IconButton>
          </div>
        </DrawerHeader>
        <Divider />
        <List className='flex flex-col justify-between h-full'>
          <ListItem
            disablePadding
            sx={{ display: 'block' }}
            onClick={() => {
              setSelected('Chat');
            }}
            className={selected === 'Chat' ? 'bg-primary' : ''}
          >
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : 'auto',
                  justifyContent: 'center',
                }}
              >
                <SmartToyIcon />
              </ListItemIcon>
              <ListItemText primary='Chat' sx={{ opacity: open ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>
          <ListItem
            disablePadding
            sx={{ display: 'block' }}
            onClick={() => {
              setSelected('Configurations');
            }}
            className={selected === 'Configurations' || selected === '' ? 'bg-primary' : ''}
          >
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : 'auto',
                  justifyContent: 'center',
                }}
              >
                <SettingsSuggestIcon />
              </ListItemIcon>
              <ListItemText primary='Configurations' sx={{ opacity: open ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      {/* <DrawerHeader /> */}
      {selected === 'Chat' ? (
        <div style={{ marginTop: '58px' }} className='flex overflow-hidden m-auto !max-w-[1100px] !min-w-[1100px]'>
          {' '}
          {showDrawerChatbot && (
            <DrawerChatbot messages={messages} isExpanded={isRightExpanded} clearHistoryData={clearHistoryData} />
          )}
          <SideNav
            messages={messages}
            isExpanded={isRightExpanded}
            position='right'
            toggleDrawer={toggleRightDrawer}
            deleteOnClick={deleteOnClick}
            showDrawerChatbot={showDrawerChatbot}
            setShowDrawerChatbot={setShowDrawerChatbot}
            setIsRightExpanded={setIsRightExpanded}
            clearHistoryData={clearHistoryData}
          />
        </div>
      ) : (
        <div className='flex  flex-col mt-6 m-auto'>
          {alertDetails.showAlert && (
            <CustomAlert
              severity={alertDetails.alertType}
              open={alertDetails.showAlert}
              handleClose={handleClose}
              alertMessage={alertDetails.alertMessage}
            />
          )}
          {/* <SideNav isExpanded={isLeftExpanded} position='left' toggleDrawer={toggleLeftDrawer} /> */}
          <div>
            <DrawerDropzone isExpanded={isLeftExpanded} />
          </div>
          <div>
            <SchemaFromTextDialog
              open={showTextFromSchemaDialog.show}
              openSettingsDialog={openSettingsDialog}
              onClose={() => {
                setShowTextFromSchemaDialog({ triggeredFrom: '', show: false });
                switch (showTextFromSchemaDialog.triggeredFrom) {
                  case 'enhancementtab':
                    setshowEnhancementDialog(true);
                    break;
                  case 'schemadialog':
                    openSettingsDialog();
                    break;
                  default:
                    break;
                }
              }}
              showAlert={showAlert}
            ></SchemaFromTextDialog>

            <SettingsModal
              openTextSchema={() => {
                setShowTextFromSchemaDialog({ triggeredFrom: 'schemadialog', show: true });
              }}
              open={isSettingPanelExpanded}
              onClose={closeSettingModal}
              settingView='headerView'
              isSchema={isSchema}
              setIsSchema={setIsSchema}
            />
            <Content
              openChatBot={() => setShowChatBot(true)}
              isLeftExpanded={isLeftExpanded}
              isRightExpanded={isRightExpanded}
              showChatBot={showChatBot}
              openTextSchema={() => {
                setShowTextFromSchemaDialog({ triggeredFrom: 'schemadialog', show: true });
              }}
              isSchema={isSchema}
              setIsSchema={setIsSchema}
              showEnhancementDialog={showEnhancementDialog}
              setshowEnhancementDialog={setshowEnhancementDialog}
              closeSettingModal={closeSettingModal}
            />
          </div>
        </div>
      )}
    </Box>
  );
}
