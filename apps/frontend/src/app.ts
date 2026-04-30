import { PropsWithChildren } from 'react';
import './app.less';

const App = ({ children }: PropsWithChildren): JSX.Element => children as JSX.Element;

export default App;
