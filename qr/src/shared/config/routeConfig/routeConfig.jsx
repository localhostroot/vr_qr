import {MainPage} from "@/pages/MainPage/index.js";
import {SelectionPage} from "@/pages/SelectionPage/index.js";
import {ContentDescriptionPage} from "@/pages/ContentDescriptionPage/index.js";
import {QueuePage} from "@/pages/QueuePage/index.js";
import {SerialFilmPage} from "@/pages/SerialFilmPage/index.js";
import {FilmsPage} from "@/pages/FilmsPage/index.js";
import { PaymentResultPage } from "@/pages/PaymentResultPage/index.js";
import { TokenEntryPage } from "@/pages/TokenEntryPage/index.js";


export const routeConfig = [
    {
        path: '/',
        element: <SelectionPage />,
        name: 'Selection',
        exact: true,
    },
    {
        path: '/vr/:location/:id',
        element: <MainPage />,
        name: 'Main',
        exact: true,
    },
    {
        path: '/content/:id',
        element: <ContentDescriptionPage />,
        name: 'Content',
        exact: true,
    },
    {
        path: '/queue/',
        element: <QueuePage />,
        name: 'Queue',
        exact: true,
    },
    {
        path: '/film/:id',
        element: <SerialFilmPage />,
        name: 'SerialFilm',
        exact: true,
    },
    {
        path: '/films/',
        element: <FilmsPage />,
        name: 'Films',
        exact: true,
    },
    {
        path: "/payment-result/",
        element: <PaymentResultPage />,
        name: 'Payment',
        exact: true,
    },
    {
        path: '/enter-token/',
        element: <TokenEntryPage />,
        name: 'Films',
        exact: true,
    },
];