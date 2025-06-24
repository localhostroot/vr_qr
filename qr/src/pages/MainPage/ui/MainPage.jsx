import style from './mainpage.module.scss'
import {useRef} from "react";
import {Header} from "../../../../../4neba_f/src/widgets/Header/index.js";
import {MainPageHeader} from "../components/MainPageHeader/MainPageHeader.jsx";
import {VrPlayer} from "../components/VrPlayer/VrPlayer.jsx";
import Loader from "@/widgets/Loader/Loader.jsx";
import useMainPageData from "../../../features/hooks/useMainPageData.js";


const MainPage = () => {
    const {
        library,
        isLibraryLoading,
        isLoading,
        urlLocation,
        urlId
    } = useMainPageData();

    const noveltyRef = useRef(null);

    const scrollToNovelty = () => {
        if (noveltyRef.current) {
            const element = noveltyRef.current;
            const top = element.offsetTop;

            window.scrollTo({
                top: top,
                behavior: 'smooth'
            });
        }
    };

    if (isLibraryLoading || isLoading) {
        return <Loader />;
    }

    return (
        library &&
        <div className={style.mainPage}>
            <Header />
            <MainPageHeader scrollFunc={scrollToNovelty} />
            <VrPlayer referense={noveltyRef} library={library} />
        </div>
    );
};

export default MainPage;