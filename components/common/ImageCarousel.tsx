"use client";

import { useState, useRef, useEffect } from 'react';

interface ImageCarouselProps {
    images: string[];
    alt: string;
}

export default function ImageCarousel({ images, alt }: ImageCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollLeft, clientWidth } = scrollRef.current;
            const index = Math.round(scrollLeft / clientWidth);
            setCurrentIndex(index);
        }
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (el) {
            el.addEventListener('scroll', handleScroll);
            return () => el.removeEventListener('scroll', handleScroll);
        }
    }, []);

    if (!images || images.length === 0) {
        return (
            <div className="room-placeholder" style={{
                height: '220px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #f5efe6 0%, #e8e2d9 100%)',
                color: '#bbb'
            }}>
                Image Available Soon
            </div>
        );
    }

    const handlePrev = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: -scrollRef.current.clientWidth, behavior: 'smooth' });
        }
    };

    const handleNext = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: scrollRef.current.clientWidth, behavior: 'smooth' });
        }
    };

    return (
        <div className="carousel-container group" style={{ position: 'relative', height: '220px', width: '100%', overflow: 'hidden' }}>
            {/* Scrollable Area */}
            <div
                ref={scrollRef}
                className="carousel-scroll"
                style={{
                    display: 'flex',
                    overflowX: 'auto',
                    scrollSnapType: 'x mandatory',
                    height: '100%',
                    scrollbarWidth: 'none', /* Firefox */
                    msOverflowStyle: 'none' /* IE/Edge */
                }}
            >

                {images.map((src, index) => (
                    <div key={index} style={{ minWidth: '100%', height: '100%', scrollSnapAlign: 'center' }}>
                        <div style={{
                            backgroundImage: `url('${src}')`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            width: '100%',
                            height: '100%'
                        }} role="img" aria-label={`${alt} - Image ${index + 1}`} />
                    </div>
                ))}
            </div>

            {/* Navigation Arrows (PC only via hover) */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={handlePrev}
                        className="carousel-nav"
                        aria-label="Previous image"
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '10px',
                            transform: 'translateY(-50%)',
                            background: 'rgba(255,255,255,0.3)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            opacity: 0,
                            transition: 'all 0.3s',
                            zIndex: 20
                        }}>
                        &#10094;
                    </button>
                    <button
                        onClick={handleNext}
                        className="carousel-nav"
                        aria-label="Next image"
                        style={{
                            position: 'absolute',
                            top: '50%',
                            right: '10px',
                            transform: 'translateY(-50%)',
                            background: 'rgba(255,255,255,0.3)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            opacity: 0,
                            transition: 'all 0.3s',
                            zIndex: 20
                        }}>
                        &#10095;
                    </button>
                </>
            )}

            {/* Dots Indicator */}
            {images.length > 1 && (
                <div className="carousel-dots" style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '8px',
                    zIndex: 10
                }}>
                    {images.map((_, index) => (
                        <div
                            key={index}
                            style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: index === currentIndex ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                                transition: 'background 0.3s'
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
